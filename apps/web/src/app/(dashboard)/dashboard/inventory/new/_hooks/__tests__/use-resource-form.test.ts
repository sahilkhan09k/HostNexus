import { renderHook, act } from "@testing-library/react";
import { useResourceForm } from "../use-resource-form";

// ── useResourceForm unit tests ───────────────────────────────────────────────
// Requirements: 7.1, 14.1
// Vitest globals (describe / it / expect) are enabled via vitest.config.ts.

describe("useResourceForm", () => {
  // ── 1 & 2: Initialization ─────────────────────────────────────────────────

  it("initialises with the correct default field values", () => {
    const { result } = renderHook(() => useResourceForm());

    // Test 1 — default values
    expect(result.current.values).toEqual({
      name: "",
      resourceType: "",
      description: "",
      quantity: 1,
      unit: "",
      location: "",
      isActive: true,
    });
  });

  it("initialises errors and touched as empty objects", () => {
    const { result } = renderHook(() => useResourceForm());

    // Test 2 — empty errors and touched
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
  });

  it("initialises isSubmitting as false", () => {
    const { result } = renderHook(() => useResourceForm());

    // Test 3 — isSubmitting is false
    expect(result.current.isSubmitting).toBe(false);
  });

  it("initialises isDirty as false", () => {
    const { result } = renderHook(() => useResourceForm());

    // Test 4 — isDirty is false
    expect(result.current.isDirty).toBe(false);
  });

  // ── 5 & 6: handleChange ───────────────────────────────────────────────────

  it("handleChange updates the targeted field value", () => {
    const { result } = renderHook(() => useResourceForm());

    act(() => {
      result.current.handleChange("name", "Test Hall");
    });

    // Test 5 — field value updated
    expect(result.current.values.name).toBe("Test Hall");
  });

  it("handleChange sets isDirty to true when a value differs from the default", () => {
    const { result } = renderHook(() => useResourceForm());

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.handleChange("name", "Test Hall");
    });

    // Test 6 — isDirty becomes true
    expect(result.current.isDirty).toBe(true);
  });

  // ── 7, 8, 9: handleBlur ───────────────────────────────────────────────────

  it("handleBlur marks the field as touched", () => {
    const { result } = renderHook(() => useResourceForm());

    expect(result.current.touched.name).toBeUndefined();

    act(() => {
      result.current.handleBlur("name");
    });

    // Test 7 — touched.name is true
    expect(result.current.touched.name).toBe(true);
  });

  it("handleBlur on an empty required field sets a validation error", () => {
    const { result } = renderHook(() => useResourceForm());

    // name is empty by default; blurring it must produce an error
    act(() => {
      result.current.handleBlur("name");
    });

    // Test 8 — error present for empty name
    expect(result.current.errors.name).toBeDefined();
    expect(typeof result.current.errors.name).toBe("string");
    expect(result.current.errors.name!.length).toBeGreaterThan(0);
  });

  it("handleBlur on a valid name clears any existing error", () => {
    const { result } = renderHook(() => useResourceForm());

    // First blur with empty value → error appears
    act(() => {
      result.current.handleBlur("name");
    });
    expect(result.current.errors.name).toBeDefined();

    // User types a valid value
    act(() => {
      result.current.handleChange("name", "Grand Hall");
    });

    // Blur with valid value → error should be cleared
    act(() => {
      result.current.handleBlur("name");
    });

    // Test 9 — error cleared for valid name
    expect(result.current.errors.name).toBeUndefined();
  });

  // ── 10 & 11: validateForm ─────────────────────────────────────────────────

  it("validateForm returns errors for empty required fields", () => {
    const { result } = renderHook(() => useResourceForm());

    // Default state has empty name and resourceType — both required
    let errors: ReturnType<typeof result.current.validateForm>;
    act(() => {
      errors = result.current.validateForm();
    });

    // Test 10 — name and resourceType errors are present
    expect(errors!.name).toBeDefined();
    expect(errors!.resourceType).toBeDefined();
  });

  it("validateForm returns an empty object when all required fields are valid", () => {
    const { result } = renderHook(() => useResourceForm());

    // Provide all required fields with valid values
    act(() => {
      result.current.handleChange("name", "Grand Banquet Hall");
      result.current.handleChange("resourceType", "Banquet Hall");
      result.current.handleChange("quantity", 10);
    });

    let errors: ReturnType<typeof result.current.validateForm>;
    act(() => {
      errors = result.current.validateForm();
    });

    // Test 11 — no validation errors
    expect(errors!).toEqual({});
  });

  // ── 12: resetForm ─────────────────────────────────────────────────────────

  it("resetForm restores all state to its initial defaults", () => {
    const { result } = renderHook(() => useResourceForm());

    // Mutate the form so we have something meaningful to reset
    act(() => {
      result.current.handleChange("name", "Event Space Alpha");
      result.current.handleChange("quantity", 50);
      result.current.handleBlur("name");         // marks touched + possibly no error
      result.current.handleBlur("resourceType"); // marks touched + shows error
    });

    expect(result.current.isDirty).toBe(true);

    // Reset
    act(() => {
      result.current.resetForm();
    });

    // Test 12 — all state back to defaults
    expect(result.current.values).toEqual({
      name: "",
      resourceType: "",
      description: "",
      quantity: 1,
      unit: "",
      location: "",
      isActive: true,
    });
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.submitError).toBeNull();
    expect(result.current.isDirty).toBe(false);
  });
});
