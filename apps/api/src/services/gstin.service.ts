import fs from "fs/promises";
import path from "path";
import { extractText, getDocumentProxy } from "unpdf";
import { prisma } from "../config/database.js";
import { KYC_DIR, MAX_KYC_BYTES } from "./upload.service.js";

/**
 * Automated KYC: read the GSTIN off an uploaded GST registration certificate
 * (Groq LLM) and confirm it against the government registry via gstinapi.in.
 */

/** "/kyc/<uuid>.pdf" — the reference returned by POST /api/upload/kyc */
const KYC_REF = /^\/kyc\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf)$/;
const MAX_PDF_PAGES = 10;
const PDF_PARSE_TIMEOUT_MS = 10_000;
const LLM_TIMEOUT_MS = 20_000;
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
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

  /** Resolves a KYC reference to its stored filename. Only files our own /api/upload/kyc wrote are accepted. */
  private static kycFileName(fileRef: string): string {
    const m = KYC_REF.exec(fileRef);
    if (!m) throw kycError(DOC_UNREADABLE_MESSAGE, "GSTIN_DOCUMENT_INVALID", 422);
    return m[1];
  }

  /** The Upload row behind a KYC reference (throws if it was never uploaded through /api/upload/kyc). */
  static async findKycUpload(fileRef: string) {
    const id = this.kycFileName(fileRef);
    const upload = await prisma.upload.findUnique({ where: { id } });
    if (!upload || upload.purpose !== "KYC") {
      throw kycError("The uploaded GST certificate could not be found. Please upload it again.", "GSTIN_DOCUMENT_INVALID", 422);
    }
    return upload;
  }

  /** Raw bytes of a private KYC document (used by registration and the admin viewer). */
  static async readKycDocument(fileRef: string): Promise<Buffer> {
    const name = this.kycFileName(fileRef);
    try {
      return await fs.readFile(path.join(KYC_DIR, name));
    } catch {
      throw kycError("The uploaded GST certificate could not be found. Please upload it again.", "GSTIN_DOCUMENT_INVALID", 404);
    }
  }

  /** KYC uses its own key when configured so concierge traffic can't exhaust it */
  private static groqKey(): string | undefined {
    return process.env.GROQ_KYC_API_KEY || process.env.GROQ_API_KEY;
  }

  private static async askGroq(model: string, content: string): Promise<string | null> {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.groqKey()}` },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 1024, messages: [{ role: "user", content }] }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
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
    if (!this.groqKey()) return null;
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
    const buf = await this.readKycDocument(fileUrl);
    if (buf.subarray(0, 4).toString() !== "%PDF") {
      throw kycError("Please upload your GST registration certificate as a PDF.", "GSTIN_DOCUMENT_INVALID", 422);
    }
    if (buf.length > MAX_KYC_BYTES) {
      throw kycError("The GST certificate must be 5MB or smaller.", "GSTIN_DOCUMENT_INVALID", 413);
    }

    let text = "";
    try {
      text = await withTimeout(
        (async () => {
          const pdf = await getDocumentProxy(new Uint8Array(buf));
          if (pdf.numPages > MAX_PDF_PAGES) {
            throw kycError("A GST certificate is only a few pages long. Please upload the certificate PDF from the GST portal.", "GSTIN_DOCUMENT_INVALID", 422);
          }
          return (await extractText(pdf, { mergePages: true })).text;
        })(),
        PDF_PARSE_TIMEOUT_MS
      );
    } catch (err) {
      if ((err as any)?.code === "GSTIN_DOCUMENT_INVALID") throw err;
      console.warn("GST certificate PDF text extraction failed:", (err as Error)?.message);
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
