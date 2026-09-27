/**
 * Minimal structured logger. Emits one JSON line per event in production and
 * redacts anything that looks like a credential before it reaches stdout.
 */

const REDACTED_KEYS = /pass(word)?|secret|token|authorization|signature|base64|api[-_]?key|cookie|otp/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACTED_KEYS.test(k) ? "[REDACTED]" : redact(v, depth + 1);
  }
  return out;
}

type Level = "info" | "warn" | "error";

function write(level: Level, msg: string, meta?: Record<string, unknown>) {
  const entry = { level, time: new Date().toISOString(), msg, ...(meta ? (redact(meta) as object) : {}) };
  const line = process.env.NODE_ENV === "production" ? JSON.stringify(entry) : entry;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => write("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write("error", msg, meta),
};

export { redact };
