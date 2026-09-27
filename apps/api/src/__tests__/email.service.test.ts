/**
 * Email service + templates: single pooled transporter, TLS settings, retry policy,
 * disabled-in-tests guard, and escaping of user-supplied values.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendMail, verify, createTransport, mockEnv } = vi.hoisted(() => {
  const sendMail = vi.fn();
  const verify = vi.fn();
  const close = vi.fn();
  return {
    sendMail,
    verify,
    createTransport: vi.fn((_opts?: unknown) => ({ sendMail, verify, close })),
    mockEnv: {
      NODE_ENV: "development",
      EMAIL_ENABLED: "true",
      EMAIL_USER: "notify@example.com",
      EMAIL_PASSWORD: "app-password-value",
      EMAIL_HOST: "smtp.gmail.com",
      EMAIL_PORT: 465,
      EMAIL_FROM: undefined,
    } as Record<string, unknown>,
  };
});

vi.mock("nodemailer", () => ({ default: { createTransport } }));
vi.mock("../config/env.js", () => ({ env: mockEnv }));

import { EmailService, maskEmail } from "../services/notifications/email.service.js";
import { renderEmail, escapeHtml, sanitizeSubject } from "../services/notifications/email-templates.js";

const content = { subject: "Booking accepted · HostNexus", html: "<p>hi</p>", text: "hi" };

beforeEach(() => {
  vi.clearAllMocks();
  EmailService.close(); // fresh transporter per test
  Object.assign(mockEnv, { NODE_ENV: "development", EMAIL_ENABLED: "true", EMAIL_USER: "notify@example.com", EMAIL_PASSWORD: "app-password-value", EMAIL_PORT: 465 });
  vi.useRealTimers();
});

describe("EmailService", () => {
  it("sends through one pooled, TLS transporter with a consistent sender", async () => {
    sendMail.mockResolvedValue({ messageId: "<m1>" });
    await expect(EmailService.send("renter@example.com", content, { type: "BOOKING_ACCEPTED" })).resolves.toBe("SENT");
    await EmailService.send("owner@example.com", content);

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.gmail.com", port: 465, secure: true, pool: true,
      auth: { user: "notify@example.com", pass: "app-password-value" },
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: '"HostNexus" <notify@example.com>',
      to: "renter@example.com",
      subject: "Booking accepted · HostNexus",
      html: "<p>hi</p>",
      text: "hi",
    }));
  });

  it("requires STARTTLS on non-465 ports", async () => {
    mockEnv.EMAIL_PORT = 587;
    sendMail.mockResolvedValue({ messageId: "<m>" });
    await EmailService.send("a@example.com", content);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: false, requireTLS: true }));
  });

  it.each([
    ["in tests", { NODE_ENV: "test" }],
    ["without credentials", { EMAIL_USER: undefined, EMAIL_PASSWORD: undefined }],
    ["when disabled", { EMAIL_ENABLED: "false" }],
  ])("skips sending %s", async (_label, override) => {
    Object.assign(mockEnv, override);
    await expect(EmailService.send("a@example.com", content)).resolves.toBe("SKIPPED");
    expect(createTransport).not.toHaveBeenCalled();
    expect(EmailService.isEnabled()).toBe(false);
  });

  it("retries a transient failure once, then succeeds", async () => {
    vi.useFakeTimers();
    sendMail.mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })).mockResolvedValueOnce({ messageId: "<m>" });
    const result = EmailService.send("a@example.com", content);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe("SENT");
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("does not retry authentication failures", async () => {
    sendMail.mockRejectedValue(Object.assign(new Error("Invalid login"), { code: "EAUTH", responseCode: 535 }));
    await expect(EmailService.send("a@example.com", content)).rejects.toThrow("Invalid login");
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last attempt and rejects so the caller can record FAILED", async () => {
    vi.useFakeTimers();
    sendMail.mockRejectedValue(Object.assign(new Error("ECONNRESET"), { code: "ECONNRESET" }));
    const result = EmailService.send("a@example.com", content);
    const assertion = expect(result).rejects.toThrow("ECONNRESET");
    await vi.runAllTimersAsync();
    await assertion;
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("strips line breaks from subjects (header injection)", async () => {
    sendMail.mockResolvedValue({ messageId: "<m>" });
    await EmailService.send("a@example.com", { ...content, subject: "Hi\r\nBcc: victim@example.com" });
    expect(sendMail.mock.calls[0][0].subject).toBe("Hi Bcc: victim@example.com");
  });

  it("verify() reports bad credentials without throwing", async () => {
    verify.mockRejectedValue(Object.assign(new Error("Invalid login"), { code: "EAUTH" }));
    await expect(EmailService.verify()).resolves.toBe(false);
    verify.mockResolvedValue(true);
    EmailService.close();
    await expect(EmailService.verify()).resolves.toBe(true);
  });

  it("masks addresses for logs", () => {
    expect(maskEmail("dilip@example.com")).toBe("d***@example.com");
    expect(maskEmail("nonsense")).toBe("***");
  });
});

describe("email templates", () => {
  it("escapes every user-supplied value in HTML", () => {
    const evil = `<img src=x onerror="alert(1)">`;
    const email = renderEmail({
      title: `Offer from ${evil}`,
      recipientName: evil,
      message: `${evil} offered ₹1,500 per day`,
      details: [{ label: "Note", value: evil }],
      cta: { label: evil, url: "https://app.hostnexus.in/dashboard/bookings?booking=1&tab=incoming" },
    });
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(email.html).toContain('href="https://app.hostnexus.in/dashboard/bookings?booking=1&amp;tab=incoming"');
  });

  it("drops non-http links from the call to action", () => {
    const email = renderEmail({ title: "t", message: "m", cta: { label: "Open", url: "javascript:alert(1)" } });
    expect(email.html).not.toContain("javascript:");
    expect(email.text).not.toContain("javascript:");
  });

  it("builds a readable plain-text fallback", () => {
    const email = renderEmail({
      title: "Booking accepted",
      recipientName: "Asha",
      message: "Line one.\nLine two.",
      details: [{ label: "Amount due", value: "₹9,000" }],
      cta: { label: "Pay now", url: "http://localhost:3000/dashboard/bookings" },
    });
    expect(email.subject).toBe("Booking accepted · HostNexus");
    expect(email.text).toContain("Hi Asha,");
    expect(email.text).toContain("Line two.");
    expect(email.text).toContain("Amount due: ₹9,000");
    expect(email.text).toContain("Pay now: http://localhost:3000/dashboard/bookings");
  });

  it("escapeHtml / sanitizeSubject basics", () => {
    expect(escapeHtml(`a&b<"'>`)).toBe("a&amp;b&lt;&quot;&#39;&gt;");
    expect(sanitizeSubject("a\nb".padEnd(400, "x")).length).toBe(160);
  });
});
