/**
 * Transactional email layout. Every dynamic value goes through escapeHtml —
 * business names, reasons and offer messages are user-supplied text.
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTemplateInput {
  /** Short heading shown at the top of the email */
  title: string;
  /** Greeting name (owner name or business name); omitted when unknown */
  recipientName?: string | null;
  /** Main message, plain text; newlines become paragraphs */
  message: string;
  /** Optional key/value facts shown as a small table (e.g. dates, amounts) */
  details?: Array<{ label: string; value: string }>;
  /** Call to action; url must be absolute (built from APP_URL on the server) */
  cta?: { label: string; url: string };
  /** Subject line; defaults to the title */
  subject?: string;
}

const BRAND = "HostNexus";
const COLOR_PRIMARY = "#047857"; // emerald-700, matches the dashboard accent
const COLOR_TEXT = "#1c1917"; // stone-900
const COLOR_MUTED = "#78716c"; // stone-500
const COLOR_BORDER = "#e7e5e4"; // stone-200

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Subjects are headers: no line breaks (header injection), bounded length. */
export function sanitizeSubject(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, 160);
}

/** Only http(s) links may appear in emails. */
function safeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function renderEmail(input: EmailTemplateInput): EmailContent {
  const subject = sanitizeSubject(input.subject ?? `${input.title} · ${BRAND}`);
  const ctaUrl = input.cta ? safeUrl(input.cta.url) : null;
  const paragraphs = input.message.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : "Hello,";

  const detailsHtml = input.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid ${COLOR_BORDER};border-radius:8px;border-collapse:separate;">
        ${input.details
          .map(
            (d, i) => `<tr>
              <td style="padding:10px 14px;font-size:13px;color:${COLOR_MUTED};${i ? `border-top:1px solid ${COLOR_BORDER};` : ""}width:40%;">${escapeHtml(d.label)}</td>
              <td style="padding:10px 14px;font-size:13px;color:${COLOR_TEXT};font-weight:600;${i ? `border-top:1px solid ${COLOR_BORDER};` : ""}">${escapeHtml(d.value)}</td>
            </tr>`
          )
          .join("")}
      </table>`
    : "";

  const ctaHtml = ctaUrl && input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
        <tr><td style="border-radius:999px;background:${COLOR_PRIMARY};">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(input.cta.label)}</a>
        </td></tr>
      </table>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${COLOR_BORDER};border-radius:16px;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid ${COLOR_BORDER};">
          <span style="font-size:18px;font-weight:700;color:${COLOR_PRIMARY};letter-spacing:-0.01em;">${BRAND}</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${COLOR_TEXT};">${escapeHtml(input.title)}</h1>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${COLOR_TEXT};">${escapeHtml(greeting)}</p>
          ${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${COLOR_TEXT};">${escapeHtml(p)}</p>`).join("")}
          ${detailsHtml}
          ${ctaHtml}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid ${COLOR_BORDER};font-size:12px;line-height:1.5;color:${COLOR_MUTED};">
          You are receiving this because you have a ${BRAND} business account. This is an automated message — please do not reply.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    input.title,
    "",
    greeting,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...(input.details?.length ? [...input.details.map((d) => `${d.label}: ${d.value}`), ""] : []),
    ...(ctaUrl && input.cta ? [`${input.cta.label}: ${ctaUrl}`, ""] : []),
    `— ${BRAND}`,
  ].join("\n");

  return { subject, html, text };
}
