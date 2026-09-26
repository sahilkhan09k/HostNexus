/**
 * H-04 (unrestricted upload / stored XSS), M-04 (evidence integrity), H-05 (KYC matching).
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";

vi.mock("../config/database.js", () => ({
  prisma: {
    upload: { create: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from "../config/database.js";
import { sniffFileType } from "../utils/file-sniff.js";
import { UploadService, UPLOADS_DIR, KYC_DIR } from "../services/upload.service.js";
import { resolveOwnedMedia, uploadIdFromUrl } from "../services/evidence.js";
import { evaluateKycMatch, namesMatch, stateMatchesGstin } from "../services/kyc-match.js";

const p = prisma as any;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n");
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64");

const written: string[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  p.upload.create.mockImplementation(async ({ data }: any) => {
    written.push(data.purpose === "KYC" ? path.join(KYC_DIR, data.id) : path.join(UPLOADS_DIR, data.id));
    return data;
  });
});
afterAll(async () => {
  await Promise.all(written.map((f) => fs.unlink(f).catch(() => {})));
});

describe("sniffFileType", () => {
  it("identifies real media and PDFs by content", () => {
    expect(sniffFileType(PNG)?.mime).toBe("image/png");
    expect(sniffFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffFileType(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))?.mime).toBe("image/webp");
    expect(sniffFileType(Buffer.from("\0\0\0\x18ftypisom\0\0"))?.mime).toBe("video/mp4");
    expect(sniffFileType(PDF)?.mime).toBe("application/pdf");
  });

  it("does not recognise HTML, SVG or scripts", () => {
    for (const s of ["<html><script>alert(1)</script>", "<svg onload=alert(1)>", "alert(document.domain)", "MZ\x90\0"]) {
      expect(sniffFileType(Buffer.from(s))).toBeNull();
    }
  });
});

describe("UploadService.storeMedia (H-04)", () => {
  it("rejects HTML disguised with an image extension and content type", async () => {
    await expect(
      UploadService.storeMedia("user-1", [{ filename: "cat.jpg", contentType: "image/jpeg", base64Data: `data:image/jpeg;base64,${b64("<html><script>alert(1)</script></html>")}` }])
    ).rejects.toMatchObject({ statusCode: 415, code: "UNSUPPORTED_TYPE" });
    expect(p.upload.create).not.toHaveBeenCalled();
  });

  it("stores a real image under a random name with the extension taken from its content", async () => {
    const [res] = await UploadService.storeMedia("user-1", [{ filename: "evil.html", base64Data: b64(PNG) }]);
    expect(res.fileUrl).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(res.mimeType).toBe("image/png");
    expect(p.upload.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ownerId: "user-1", purpose: "MEDIA", mimeType: "image/png", sha256: res.fileHash }),
    });
  });

  it("caps the number of files per request", async () => {
    const files = Array.from({ length: 11 }, () => ({ filename: "a.png", base64Data: b64(PNG) }));
    await expect(UploadService.storeMedia("user-1", files)).rejects.toMatchObject({ statusCode: 413, code: "TOO_MANY_FILES" });
  });

  it("rejects PDFs on the public media endpoint", async () => {
    await expect(UploadService.storeMedia("user-1", [{ filename: "a.pdf", base64Data: b64(PDF) }])).rejects.toMatchObject({ statusCode: 415 });
  });
});

describe("UploadService.storeKycDocument", () => {
  it("accepts only PDFs and stores them privately (not under /uploads)", async () => {
    const res = await UploadService.storeKycDocument({ filename: "gst.pdf", base64Data: b64(PDF) });
    expect(res.fileUrl).toMatch(/^\/kyc\/[0-9a-f-]{36}\.pdf$/);
    expect(KYC_DIR.startsWith(UPLOADS_DIR + path.sep)).toBe(false);
    expect(p.upload.create).toHaveBeenCalledWith({ data: expect.objectContaining({ ownerId: null, purpose: "KYC" }) });
  });

  it("rejects non-PDF KYC documents", async () => {
    await expect(UploadService.storeKycDocument({ filename: "gst.pdf", base64Data: b64(PNG) })).rejects.toMatchObject({
      code: "GSTIN_DOCUMENT_INVALID",
    });
  });

  it("rejects KYC documents over 5MB", async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);
    await expect(UploadService.storeKycDocument({ filename: "gst.pdf", base64Data: b64(big) })).rejects.toMatchObject({ statusCode: 413 });
  });
});

describe("resolveOwnedMedia (M-04 evidence integrity)", () => {
  const id = "0b6c6f5e-1f1a-4c1e-9a55-0d2b1f0a9e11.jpg";

  it("normalises absolute API URLs to the canonical path and records the file hash", async () => {
    p.upload.findMany.mockResolvedValue([{ id, ownerId: "user-1", purpose: "MEDIA", mimeType: "image/jpeg", sha256: "abc" }]);
    const [m] = await resolveOwnedMedia("user-1", [`http://localhost:5000/uploads/${id}`]);
    expect(m).toEqual({ fileUrl: `/uploads/${id}`, fileHash: "abc", type: "IMAGE" });
  });

  it("rejects another user's upload", async () => {
    p.upload.findMany.mockResolvedValue([{ id, ownerId: "user-2", purpose: "MEDIA", mimeType: "image/jpeg", sha256: "abc" }]);
    await expect(resolveOwnedMedia("user-1", [`/uploads/${id}`])).rejects.toMatchObject({ code: "INVALID_MEDIA_REFERENCE" });
  });

  it("rejects external URLs, javascript: URLs and KYC documents", async () => {
    p.upload.findMany.mockResolvedValue([]);
    for (const url of ["https://evil.example/pixel.gif", "javascript:alert(1)", "/kyc/0b6c6f5e-1f1a-4c1e-9a55-0d2b1f0a9e11.pdf", "/uploads/../.env"]) {
      await expect(resolveOwnedMedia("user-1", [url])).rejects.toMatchObject({ code: "INVALID_MEDIA_REFERENCE" });
    }
  });

  it("keeps URLs already on the record (legacy listings stay editable)", async () => {
    const legacy = "https://cdn.example.com/old.jpg";
    const [m] = await resolveOwnedMedia("user-1", [legacy], { keep: [legacy] });
    expect(m.fileUrl).toBe(legacy);
  });

  it("uploadIdFromUrl ignores the host of absolute URLs", () => {
    expect(uploadIdFromUrl(`https://evil.example/uploads/${id}`)).toBe(id);
    expect(uploadIdFromUrl("/uploads/not-a-uuid.jpg")).toBeNull();
  });
});

describe("KYC name/state cross-check (H-05)", () => {
  it("matches corporate names regardless of suffixes and punctuation", () => {
    expect(namesMatch("Sunrise Caterers", "SUNRISE CATERERS PRIVATE LIMITED")).toBe(true);
    expect(namesMatch("M/s. Hotel Blue Moon", "HOTEL BLUE MOON")).toBe(true);
    expect(namesMatch("Sunrise Caterers", "TAJ HOTELS LIMITED")).toBe(false);
    expect(namesMatch("Pvt Ltd", "Private Limited")).toBe(false); // nothing identifying left
  });

  it("maps the GSTIN state code to the declared state", () => {
    expect(stateMatchesGstin("27AAPFU0939F1ZV", "Maharashtra")).toBe(true);
    expect(stateMatchesGstin("27AAPFU0939F1ZV", "Karnataka")).toBe(false);
    expect(stateMatchesGstin("07AAPFU0939F1ZV", "Delhi")).toBe(true);
  });

  it("accepts a proprietorship where the legal name is the owner's name", () => {
    const r = evaluateKycMatch({
      gstin: "27AAPFU0939F1ZV", legalName: "RAVI KUMAR SHARMA", tradeName: "SHARMA TENT HOUSE",
      businessName: "Sharma Tent House", ownerName: "Ravi Kumar Sharma", state: "Maharashtra",
    });
    expect(r.autoVerified).toBe(true);
  });

  it("does not auto-verify when the registry returns no names", () => {
    const r = evaluateKycMatch({
      gstin: "27AAPFU0939F1ZV", legalName: null, tradeName: null,
      businessName: "Anything", ownerName: "Anyone", state: "Maharashtra",
    });
    expect(r.autoVerified).toBe(false);
  });
});
