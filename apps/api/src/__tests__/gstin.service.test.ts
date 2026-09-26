import { describe, it, expect, vi, afterEach } from "vitest";
import { GstinService } from "../services/gstin.service.js";

const VALID = "27AAPFU0939F1ZV";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("GstinService.isValidGstin", () => {
  it("accepts a GSTIN with a correct check digit", () => {
    expect(GstinService.isValidGstin(VALID)).toBe(true);
  });

  it("rejects a wrong check digit or bad format", () => {
    expect(GstinService.isValidGstin("27AAPFU0939F1ZA")).toBe(false);
    expect(GstinService.isValidGstin("27AAPFU0939F1Z")).toBe(false);
    expect(GstinService.isValidGstin("XXAAPFU0939F1ZV")).toBe(false);
  });
});

describe("GstinService.findGstin", () => {
  it("pulls the GSTIN out of noisy LLM or PDF text", () => {
    expect(GstinService.findGstin(`Registration Number: 27aapfu 0939f1zv\nLegal Name: X`)).toBe(VALID);
  });

  it("returns null when nothing checksum-valid is present", () => {
    expect(GstinService.findGstin("NONE")).toBeNull();
    expect(GstinService.findGstin("27AAPFU0939F1ZA")).toBeNull();
  });
});

describe("GstinService.extractFromDocument", () => {
  it("refuses URLs outside the uploads folder", async () => {
    await expect(GstinService.extractFromDocument("https://evil.example/x.png")).rejects.toMatchObject({
      code: "GSTIN_DOCUMENT_INVALID",
    });
  });
});

describe("GstinService.verify", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns details for an Active GSTIN", async () => {
    vi.stubEnv("GSTIN_API_KEY", "gak_test");
    const fetchMock = mockFetch(200, {
      success: true,
      data: { gstin: VALID, legal_name: "TEST HOSPITALITY LLP", trade_name: "TEST", status: "Active" },
    });

    const result = await GstinService.verify(VALID);
    expect(result).toMatchObject({ gstin: VALID, legalName: "TEST HOSPITALITY LLP", status: "Active" });
    expect(fetchMock.mock.calls[0][0]).toBe(`https://www.gstinapi.in/v1/gstin/${VALID}`);
    expect(fetchMock.mock.calls[0][1].headers["x-api-key"]).toBe("gak_test");
  });

  it("rejects an unregistered GSTIN", async () => {
    vi.stubEnv("GSTIN_API_KEY", "gak_test");
    mockFetch(404, { success: false, error: "GSTIN not found" });
    await expect(GstinService.verify(VALID)).rejects.toMatchObject({ code: "GSTIN_NOT_VERIFIED", statusCode: 422 });
  });

  it("rejects a cancelled GSTIN", async () => {
    vi.stubEnv("GSTIN_API_KEY", "gak_test");
    mockFetch(200, { success: true, data: { gstin: VALID, status: "Cancelled" } });
    await expect(GstinService.verify(VALID)).rejects.toMatchObject({ code: "GSTIN_NOT_ACTIVE" });
  });

  it("reports the service as unavailable when out of credits", async () => {
    vi.stubEnv("GSTIN_API_KEY", "gak_test");
    mockFetch(402, { success: false, error: "Insufficient credits" });
    await expect(GstinService.verify(VALID)).rejects.toMatchObject({ code: "GSTIN_SERVICE_UNAVAILABLE", statusCode: 503 });
  });
});

describe("GstinService.extractFromDocument (file type)", () => {
  it("rejects uploads that are not PDFs", async () => {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(process.cwd(), "uploads");
    await fs.mkdir(dir, { recursive: true });
    const name = `test-not-pdf-${Date.now()}.png`;
    await fs.writeFile(path.join(dir, name), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    try {
      await expect(GstinService.extractFromDocument(`/uploads/${name}`)).rejects.toMatchObject({
        code: "GSTIN_DOCUMENT_INVALID",
        message: "Please upload your GST registration certificate as a PDF.",
      });
    } finally {
      await fs.unlink(path.join(dir, name));
    }
  });
});
