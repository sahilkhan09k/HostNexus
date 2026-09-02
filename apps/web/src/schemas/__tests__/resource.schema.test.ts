import { resourceFormSchema, RESOURCE_TYPES } from "../resource.schema";

// Helper: parse and return the first error message for a field
function getError(result: ReturnType<typeof resourceFormSchema.safeParse>, field: string): string | undefined {
  if (result.success) return undefined;
  const issue = result.error.issues.find((i) => i.path[0] === field);
  return issue?.message;
}

const validComplete = {
  name: "Grand Ballroom",
  resourceType: "Banquet Hall" as const,
  description: "A beautiful venue for events",
  quantity: 1,
  unit: "hall",
  location: "New York, NY",
  isActive: true,
};

const validMinimal = {
  name: "Meeting Room A",
  resourceType: "Meeting Space" as const,
  quantity: 5,
  isActive: false,
};

describe("resourceFormSchema", () => {
  // 1. Valid complete data passes
  it("passes with valid complete data", () => {
    const result = resourceFormSchema.safeParse(validComplete);
    expect(result.success).toBe(true);
  });

  // 2. Valid minimal data passes
  it("passes with valid minimal data (name, resourceType, quantity, isActive)", () => {
    const result = resourceFormSchema.safeParse(validMinimal);
    expect(result.success).toBe(true);
  });

  // --- name field ---

  // 3. name empty string fails
  it("fails when name is empty string", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, name: "" });
    expect(result.success).toBe(false);
    expect(getError(result, "name")).toBeTruthy();
  });

  // 4. name 2 chars fails with "at least 3"
  it("fails when name is 2 characters with message containing 'at least 3'", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, name: "AB" });
    expect(result.success).toBe(false);
    expect(getError(result, "name")).toMatch(/at least 3/i);
  });

  // 5. name 101 chars fails with message containing "100"
  it("fails when name exceeds 100 characters with message containing '100'", () => {
    const longName = "A".repeat(101);
    const result = resourceFormSchema.safeParse({ ...validMinimal, name: longName });
    expect(result.success).toBe(false);
    expect(getError(result, "name")).toMatch(/100/);
  });

  // --- resourceType field ---

  // 6. missing resourceType fails with "Please select a resource category"
  it("fails when resourceType is missing with 'Please select a resource category'", () => {
    const { resourceType: _, ...noType } = validMinimal;
    const result = resourceFormSchema.safeParse(noType);
    expect(result.success).toBe(false);
    expect(getError(result, "resourceType")).toBe("Please select a resource category");
  });

  // 7. invalid resourceType fails
  it("fails when resourceType is an invalid value", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, resourceType: "Random Type" });
    expect(result.success).toBe(false);
    expect(getError(result, "resourceType")).toBe("Please select a resource category");
  });

  // 8. each of the 18 RESOURCE_TYPES passes
  it.each(RESOURCE_TYPES)("passes for valid resourceType: %s", (type) => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, resourceType: type });
    expect(result.success).toBe(true);
  });

  // --- quantity field ---

  // 9. quantity 0 fails with "at least 1"
  it("fails when quantity is 0 with message containing 'at least 1'", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, quantity: 0 });
    expect(result.success).toBe(false);
    expect(getError(result, "quantity")).toMatch(/at least 1/i);
  });

  // 10. quantity 10001 fails with "10,000"
  it("fails when quantity is 10001 with message containing '10,000'", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, quantity: 10001 });
    expect(result.success).toBe(false);
    expect(getError(result, "quantity")).toMatch(/10,000/);
  });

  // 11. quantity 1.5 fails (integer check)
  it("fails when quantity is a decimal (1.5)", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, quantity: 1.5 });
    expect(result.success).toBe(false);
    expect(getError(result, "quantity")).toBeTruthy();
  });

  // --- description field ---

  // 12. description 1001 chars fails
  it("fails when description exceeds 1000 characters", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, description: "X".repeat(1001) });
    expect(result.success).toBe(false);
    expect(getError(result, "description")).toBeTruthy();
  });

  // 13. description undefined passes
  it("passes when description is undefined", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, description: undefined });
    expect(result.success).toBe(true);
  });

  // --- unit field ---

  // 14. unit 51 chars fails
  it("fails when unit exceeds 50 characters", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, unit: "U".repeat(51) });
    expect(result.success).toBe(false);
    expect(getError(result, "unit")).toBeTruthy();
  });

  // 15. unit undefined passes
  it("passes when unit is undefined", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, unit: undefined });
    expect(result.success).toBe(true);
  });

  // --- location field ---

  // 16. location 201 chars fails
  it("fails when location exceeds 200 characters", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, location: "L".repeat(201) });
    expect(result.success).toBe(false);
    expect(getError(result, "location")).toBeTruthy();
  });

  // 17. location undefined passes
  it("passes when location is undefined", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, location: undefined });
    expect(result.success).toBe(true);
  });

  // --- isActive field ---

  // 18a. isActive true passes
  it("passes when isActive is true", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, isActive: true });
    expect(result.success).toBe(true);
  });

  // 18b. isActive false passes
  it("passes when isActive is false", () => {
    const result = resourceFormSchema.safeParse({ ...validMinimal, isActive: false });
    expect(result.success).toBe(true);
  });
});
