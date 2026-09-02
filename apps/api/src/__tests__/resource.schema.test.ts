import { describe, it, expect } from "vitest";
import {
  createResourceSchema,
  VALID_RESOURCE_TYPES,
} from "../schemas/resource.schema.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function valid() {
  return {
    name: "Main Banquet Hall",
    description: "Seats up to 500 guests with full AV setup",
    resourceType: "Banquet Hall",
    quantity: 1,
    unit: "hall",
    status: "available" as const,
    location: "Block A, Ground Floor",
    isActive: true,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createResourceSchema", () => {
  // 1. Valid complete data passes
  it("accepts valid complete data (all fields)", () => {
    const result = createResourceSchema.safeParse(valid());
    expect(result.success).toBe(true);
  });

  // 2. Valid minimal data — status and isActive use defaults
  it("accepts minimal data (name, resourceType, quantity) and applies defaults", () => {
    const result = createResourceSchema.safeParse({
      name: "Simple Hall",
      resourceType: "Banquet Hall",
      quantity: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("available");
      expect(result.data.isActive).toBe(true);
    }
  });

  // 3. name 2 chars → fails
  it("rejects name shorter than 3 characters", () => {
    const result = createResourceSchema.safeParse({ ...valid(), name: "AB" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain("Name must be at least 3 characters");
    }
  });

  // 4. name 101 chars → fails
  it("rejects name longer than 100 characters", () => {
    const result = createResourceSchema.safeParse({
      ...valid(),
      name: "A".repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain("Name cannot exceed 100 characters");
    }
  });

  // 5. name missing → fails
  it("rejects missing name field", () => {
    const { name: _omitted, ...withoutName } = valid();
    const result = createResourceSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
  });

  // 6. invalid resourceType "Ballroom" → fails
  it("rejects invalid resourceType 'Ballroom'", () => {
    const result = createResourceSchema.safeParse({
      ...valid(),
      resourceType: "Ballroom",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain("Invalid resource type");
    }
  });

  // 7. empty resourceType "" → fails "Resource type is required"
  it("rejects empty string resourceType", () => {
    const result = createResourceSchema.safeParse({
      ...valid(),
      resourceType: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain("Resource type is required");
    }
  });

  // 8. All 18 VALID_RESOURCE_TYPES pass
  it.each(VALID_RESOURCE_TYPES)(
    "accepts valid resourceType '%s'",
    (resourceType) => {
      const result = createResourceSchema.safeParse({ ...valid(), resourceType });
      expect(result.success).toBe(true);
    }
  );

  // 9. quantity 0 → fails
  it("rejects quantity of 0", () => {
    const result = createResourceSchema.safeParse({ ...valid(), quantity: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain("Quantity must be at least 1");
    }
  });

  // 10. quantity 10001 → fails
  it("rejects quantity greater than 10,000", () => {
    const result = createResourceSchema.safeParse({
      ...valid(),
      quantity: 10001,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain("Quantity cannot exceed 10,000");
    }
  });

  // 11. quantity 1.5 → fails
  it("rejects non-integer quantity (1.5)", () => {
    const result = createResourceSchema.safeParse({
      ...valid(),
      quantity: 1.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain("Quantity must be a whole number");
    }
  });

  // 12. description 1001 chars → fails
  it("rejects description longer than 1000 characters", () => {
    const result = createResourceSchema.safeParse({
      ...valid(),
      description: "D".repeat(1001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain("Description must be 1000 characters or less");
    }
  });

  // 13. description undefined → passes (field is optional)
  it("accepts undefined description (optional field)", () => {
    const { description: _omitted, ...withoutDesc } = valid();
    const result = createResourceSchema.safeParse(withoutDesc);
    expect(result.success).toBe(true);
  });

  // 14. unit 51 chars → fails
  it("rejects unit longer than 50 characters", () => {
    const result = createResourceSchema.safeParse({
      ...valid(),
      unit: "U".repeat(51),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain("Unit must be 50 characters or less");
    }
  });

  // 15. unit undefined → passes (field is optional)
  it("accepts undefined unit (optional field)", () => {
    const { unit: _omitted, ...withoutUnit } = valid();
    const result = createResourceSchema.safeParse(withoutUnit);
    expect(result.success).toBe(true);
  });

  // 16. location 201 chars → fails
  it("rejects location longer than 200 characters", () => {
    const result = createResourceSchema.safeParse({
      ...valid(),
      location: "L".repeat(201),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain("Location must be 200 characters or less");
    }
  });
});
