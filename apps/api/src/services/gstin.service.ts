import fs from "fs/promises";
import path from "path";
import { extractText, getDocumentProxy } from "unpdf";

/**
 * Automated KYC: read the GSTIN off an uploaded GST registration certificate
 * (Groq LLM) and confirm it against the government registry via gstinapi.in.
 */

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const GSTIN_API_URL = "https://www.gstinapi.in/v1/gstin";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Tried in order on the certificate's extracted text.
const GROQ_TEXT_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "llama-3.3-70b-versatile"];

const GSTIN_PATTERN = /\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]/g;
const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const EXTRACT_PROMPT =
  "This should be an Indian GST registration certificate (Form GST REG-06). " +
  "Find the GSTIN / Registration Number: a 15-character code like 27AAPFU0939F1ZV. " +
  'Reply with only the GSTIN, or NONE if the document is not a GST certificate or has no GSTIN.';

export interface GstinDetails {
  gstin: string;
  legalName: string | null;
  tradeName: string | null;
  status: string | null;
}

function kycError(message: string, code: string, statusCode: number): Error {
  const err = new Error(message);
  (err as any).code = code;
  (err as any).statusCode = statusCode;
  return err;
}

const DOC_UNREADABLE_MESSAGE =
  "We couldn't find a GSTIN in the uploaded document. Please upload a clear copy of your GST registration certificate.";

export class GstinService {
  /** Format + checksum check (last character is a mod-36 check digit). */
  static isValidGstin(gstin: string): boolean {
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return false;
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      const product = CHARSET.indexOf(gstin[i]) * (i % 2 === 0 ? 1 : 2);
      sum += Math.floor(product / 36) + (product % 36);
    }
    return CHARSET[(36 - (sum % 36)) % 36] === gstin[14];
  }

  /** First checksum-valid GSTIN in free text (LLM reply or PDF text). */
  static findGstin(text: string): string | null {
    const candidates = text.toUpperCase().replace(/[\s-]/g, "").match(GSTIN_PATTERN) ?? [];
    return candidates.find((c) => this.isValidGstin(c)) ?? null;
  }

  /** Only files our own /api/upload wrote are readable here. */
  private static async readUpload(fileUrl: string): Promise<Buffer> {
    if (!fileUrl.startsWith("/uploads/")) {
      throw kycError(DOC_UNREADABLE_MESSAGE, "GSTIN_DOCUMENT_INVALID", 422);
    }
    try {
      return await fs.readFile(path.join(UPLOADS_DIR, path.basename(fileUrl)));
    } catch {
      throw kycError("The uploaded GST certificate could not be found. Please upload it again.", "GSTIN_DOCUMENT_INVALID", 422);
    }
  }

  private static async askGroq(model: string, content: string): Promise<string | null> {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 1024, messages: [{ role: "user", content }] }),
    });
    if (!res.ok) {
      console.warn(`Groq ${model} GSTIN extraction failed: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as any;
    return data?.choices?.[0]?.message?.content ?? null;
  }

  /** Try each model until one returns a checksum-valid GSTIN. */
  private static async extractWithGroq(models: string[], content: string): Promise<string | null> {
    if (!process.env.GROQ_API_KEY) return null;
    for (const model of models) {
      try {
        const reply = await this.askGroq(model, content);
        const gstin = reply ? this.findGstin(reply) : null;
        if (gstin) return gstin;
      } catch (err) {
        console.warn(`Groq ${model} GSTIN extraction errored:`, err);
      }
    }
    return null;
  }

  /** Pull the GSTIN out of an uploaded certificate. Only text PDFs are accepted. */
  static async extractFromDocument(fileUrl: string): Promise<string> {
    const buf = await this.readUpload(fileUrl);
    if (buf.subarray(0, 4).toString() !== "%PDF") {
      throw kycError("Please upload your GST registration certificate as a PDF.", "GSTIN_DOCUMENT_INVALID", 422);
    }

    let text = "";
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      text = (await extractText(pdf, { mergePages: true })).text;
    } catch (err) {
      console.warn("GST certificate PDF text extraction failed:", err);
    }
    if (!text.trim()) {
      throw kycError(
        "This PDF looks scanned, so we couldn't read it. Please upload the certificate PDF downloaded from the GST portal.",
        "GSTIN_NOT_FOUND",
        422
      );
    }

    const gstin =
      (await this.extractWithGroq(GROQ_TEXT_MODELS, `${EXTRACT_PROMPT}\n\nDocument text:\n${text.slice(0, 12000)}`)) ??
      this.findGstin(text);
    if (!gstin) throw kycError(DOC_UNREADABLE_MESSAGE, "GSTIN_NOT_FOUND", 422);
    return gstin;
  }

  /** Confirm the GSTIN is registered and Active with the GST registry. */
  static async verify(gstin: string): Promise<GstinDetails> {
    const apiKey = process.env.GSTIN_API_KEY;
    const unavailable = kycError(
      "GST verification is temporarily unavailable. Please try again in a few minutes.",
      "GSTIN_SERVICE_UNAVAILABLE",
      503
    );
    if (!apiKey) {
      console.error("GSTIN_API_KEY is not set; cannot verify GSTIN");
      throw unavailable;
    }

    let res: Response;
    try {
      res = await fetch(`${GSTIN_API_URL}/${gstin}`, {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      console.error("GSTIN API request failed:", err);
      throw unavailable;
    }

    if (res.status === 400 || res.status === 404) {
      throw kycError(
        `GSTIN ${gstin} is not registered with the GST department. Please upload your correct GST registration certificate.`,
        "GSTIN_NOT_VERIFIED",
        422
      );
    }
    if (!res.ok) {
      // 401 bad key, 402 out of credits, 429 rate limit, 502 upstream down
      console.error(`GSTIN API returned ${res.status}`);
      throw unavailable;
    }

    const body = (await res.json()) as any;
    const data = body?.data ?? {};
    const status: string | null = data.status ?? null;
    if (!body?.success || status?.toLowerCase() !== "active") {
      throw kycError(
        `GSTIN ${gstin} is ${status ? status.toLowerCase() : "not active"}. Only businesses with an active GST registration can join.`,
        "GSTIN_NOT_ACTIVE",
        422
      );
    }

    return {
      gstin,
      legalName: data.legal_name ?? null,
      tradeName: data.trade_name ?? null,
      status,
    };
  }
}
