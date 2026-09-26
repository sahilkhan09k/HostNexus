import { describe, it, expect } from "vitest";
import { mediaUrl } from "../media";

describe("mediaUrl", () => {
  it("resolves canonical upload paths against the API origin", () => {
    expect(mediaUrl("/uploads/0b6c6f5e-1f1a-4c1e-9a55-0d2b1f0a9e11.jpg")).toMatch(
      /^https?:\/\/[^/]+\/uploads\/0b6c6f5e-1f1a-4c1e-9a55-0d2b1f0a9e11\.jpg$/
    );
  });

  it("passes through http(s) URLs and same-origin static paths", () => {
    expect(mediaUrl("https://images.example.com/a.jpg")).toBe("https://images.example.com/a.jpg");
    expect(mediaUrl("/images/hero.jpg")).toBe("/images/hero.jpg");
  });

  it("drops dangerous or unexpected schemes", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.example/x.png", "vbscript:x"]) {
      expect(mediaUrl(bad)).toBe("");
    }
    expect(mediaUrl(null)).toBe("");
  });
});
