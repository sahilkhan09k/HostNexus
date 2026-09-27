import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { sanitizeSubject, type EmailContent } from "./email-templates.js";

/**
 * The only place that talks SMTP. One pooled transporter per process, created lazily
 * from EMAIL_* env vars. Credentials never leave this module and are never logged.
 */

export type EmailResult = "SENT" | "SKIPPED";

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2_000;

let transporter: Transporter | null = null;

/** Email is sent only with credentials, outside tests, and unless explicitly disabled. */
function isEnabled(): boolean {
  return env.NODE_ENV !== "test" && env.EMAIL_ENABLED === "true" && Boolean(env.EMAIL_USER && env.EMAIL_PASSWORD);
}

function getTransporter(): Transporter {
  if (!transporter) {
    const secure = env.EMAIL_PORT === 465;
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure, // implicit TLS on 465
      requireTLS: !secure, // STARTTLS is mandatory on 587/25 — never send credentials in clear text
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

function fromAddress(): string {
  return env.EMAIL_FROM ?? `"HostNexus" <${env.EMAIL_USER}>`;
}

/** "dilip@example.com" → "d***@example.com" for logs */
export function maskEmail(address: string): string {
  const [local, domain] = address.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

/** Authentication and address errors won't succeed on retry. */
function isPermanent(err: unknown): boolean {
  const e = err as { code?: string; responseCode?: number };
  if (e.code === "EAUTH" || e.code === "ENOAUTH" || e.code === "EENVELOPE") return true;
  return typeof e.responseCode === "number" && e.responseCode >= 500;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const EmailService = {
  isEnabled,

  /**
   * Sends one email. Resolves "SKIPPED" when email is not configured, "SENT" on success,
   * and rejects after the final failed attempt so the caller can record the failure.
   */
  async send(to: string, content: EmailContent, meta: { type?: string } = {}): Promise<EmailResult> {
    if (!isEnabled()) return "SKIPPED";

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const info = await getTransporter().sendMail({
          from: fromAddress(),
          to,
          subject: sanitizeSubject(content.subject),
          text: content.text,
          html: content.html,
        });
        logger.info("Email sent", { type: meta.type, to: maskEmail(to), messageId: info.messageId, attempt });
        return "SENT";
      } catch (err) {
        lastError = err;
        const e = err as { code?: string; responseCode?: number; message?: string };
        logger.warn("Email attempt failed", {
          type: meta.type,
          to: maskEmail(to),
          attempt,
          code: e.code,
          responseCode: e.responseCode,
          error: e.message,
        });
        if (isPermanent(err) || attempt === MAX_ATTEMPTS) break;
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
    throw lastError;
  },

  /** Checks the SMTP connection and credentials without sending anything. */
  async verify(): Promise<boolean> {
    if (!isEnabled()) return false;
    try {
      await getTransporter().verify();
      return true;
    } catch (err) {
      const e = err as { code?: string; message?: string };
      logger.error("SMTP verification failed", { code: e.code, error: e.message });
      return false;
    }
  },

  close(): void {
    transporter?.close();
    transporter = null;
  },
};
