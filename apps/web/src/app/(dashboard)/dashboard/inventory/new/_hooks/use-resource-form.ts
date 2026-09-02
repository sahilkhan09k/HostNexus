"use client";

import { useState } from "react";
import { resourceFormSchema } from "@/schemas/resource.schema";
/**
 * Shape of validated form values.
 * Mirrors ResourceFormValues but uses string for resourceType
 * so the controlled select can hold an empty string before a choice is made.
 */
export interface FormValues {
  name: string;
  resourceType: string;
  description: string;
  quantity: number;
  unit: string;
  location: string;
  isActive: boolean;
}

/**
 * Per-field validation error messages.
 * A key is present only when that field has a validation error.
 */
export interface FormErrors {
  name?: string;
  resourceType?: string;
  description?: string;
  quantity?: string;
  unit?: string;
  location?: string;
  isActive?: string;
}

/**
 * Tracks which fields the user has interacted with (blurred at least once).
 * Errors are only shown for touched fields.
 */
export interface FormTouched {
  name?: boolean;
  resourceType?: boolean;
  description?: boolean;
  quantity?: boolean;
  unit?: boolean;
  location?: boolean;
  isActive?: boolean;
}

/**
 * Default form values applied on mount and after a successful reset.
 * Requirements: 4.3 (quantity defaults to 1), 5.2 (isActive defaults to true)
 */
const DEFAULT_VALUES: FormValues = {
  name: "",
  resourceType: "",
  description: "",
  quantity: 1,
  unit: "",
  location: "",
  isActive: true,
};

/**
 * Options accepted by the useResourceForm hook.
 */
export interface UseResourceFormOptions {
  /** Called after a successful resource creation API response. */
  onSuccess?: () => void;
}

/**
 * Return type of the useResourceForm hook.
 * Exposes all state slices and handler callbacks required by the ResourceForm UI.
 *
 * Requirements: 4.3, 5.2, 14.1
 */
export interface UseResourceFormReturn {
  /** Current values for all form fields. */
  values: FormValues;

  /** Validation error messages keyed by field name. */
  errors: FormErrors;

  /**
   * Tracks which fields have been interacted with.
   * Errors are rendered only for touched fields to avoid noise on first render.
   */
  touched: FormTouched;

  /** True while the API request is in-flight. */
  isSubmitting: boolean;

  /** Error message returned by the server or a generic fallback, null otherwise. */
  submitError: string | null;

  /**
   * True when at least one field value differs from the default values.
   * Used to trigger the unsaved-changes navigation guard (Requirement 14.1).
   */
  isDirty: boolean;

  /**
   * Updates a single field value and clears any existing error for that field
   * if the new value is now valid (Requirement 7.4).
   *
   * @param field - The field key to update.
   * @param value - The new value for that field.
   */
  handleChange: (field: keyof FormValues, value: FormValues[keyof FormValues]) => void;

  /**
   * Marks a field as touched and runs per-field validation so an error
   * appears immediately when the user leaves an invalid field (Req 7.1, 7.2).
   *
   * @param field - The field key that lost focus.
   */
  handleBlur: (field: keyof FormValues) => void;

  /**
   * Validates and submits the form.
   * Full implementation is added in task 3.3.
   *
   * @param e - The React form submission event.
   */
  handleSubmit: (e: React.FormEvent) => Promise<void>;

  /**
   * Resets all form state back to defaults.
   * Clears values, errors, touched, and submitError.
   * isDirty returns to false automatically because it is derived from values.
   */
  resetForm: () => void;

  /**
   * Validates a single field and returns the error message or undefined.
   * Exposed so UI components can pre-validate before blur if needed.
   *
   * @param field - The field key to validate.
   * @param value - The value to validate.
   */
  validateField: (field: keyof FormValues, value: FormValues[keyof FormValues]) => string | undefined;

  /**
   * Validates all fields at once and returns a FormErrors object.
   * Keys are only present for fields that failed validation.
   */
  validateForm: () => FormErrors;
}

/**
 * Custom hook encapsulating all state management for the Resource Listing Form.
 *
 * Manages form values, per-field validation errors, touched tracking,
 * submission state, and dirty detection. Exposes handlers consumed directly
 * by `ResourceForm`.
 *
 * @param options - Optional configuration object.
 * @param options.onSuccess - Callback invoked after a successful resource
 *   creation API response (HTTP 201). Typically used to trigger navigation
 *   or a success banner in the parent page.
 * @returns {UseResourceFormReturn} All form state slices and event handlers
 *   required to drive the `ResourceForm` UI.
 */
export function useResourceForm(
  options: UseResourceFormOptions = {}
): UseResourceFormReturn {
  // ── Form values ─────────────────────────────────────────────────────────────
  const [values, setValues] = useState<FormValues>(DEFAULT_VALUES);

  // ── Validation state ─────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<FormTouched>({});

  // ── Submission state ─────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Dirty tracking ──────────────────────────────────────────────────────────
  // isDirty is derived from values so it is always in sync without a separate
  // state variable, satisfying Requirement 14.1 without risk of stale state.
  const isDirty = (Object.keys(DEFAULT_VALUES) as Array<keyof FormValues>).some(
    (key) => values[key] !== DEFAULT_VALUES[key]
  );

  // ── Validation helpers ──────────────────────────────────────────────────────

  /**
   * Validates a single field against the corresponding shape of resourceFormSchema.
   * Uses safeParse on a partial object containing only that field so Zod can
   * produce the exact error message for that constraint.
   *
   * Returns the first error message string for the field, or undefined when valid.
   *
   * Requirements: 7.1, 7.2, 7.4, 7.10
   */
  const validateField = (
    field: keyof FormValues,
    value: FormValues[keyof FormValues]
  ): string | undefined => {
    // Build a minimal object with just this field so Zod evaluates it in isolation.
    const singleFieldSchema = resourceFormSchema.pick({ [field]: true } as Record<keyof FormValues, true>);
    const result = singleFieldSchema.safeParse({ [field]: value });
    if (!result.success) {
      // Return the first issue message for this field.
      return result.error.issues[0]?.message;
    }
    return undefined;
  };

  /**
   * Validates all form fields at once.
   * Returns a FormErrors object — keys are present only for fields that failed.
   * Optional fields (description, unit, location) are marked valid when empty
   * per Requirement 7.10.
   *
   * Requirements: 7.5, 7.6
   */
  const validateForm = (): FormErrors => {
    const result = resourceFormSchema.safeParse(values);
    if (result.success) return {};

    const newErrors: FormErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof FormErrors;
      if (field && !newErrors[field]) {
        newErrors[field] = issue.message;
      }
    }
    return newErrors;
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  /**
   * Updates a single field value.
   * Clears the field's error immediately when the user starts typing so that
   * the UI doesn't show stale errors for a field that is being corrected
   * (Requirement 7.4 — remove error when field becomes valid).
   *
   * Full re-validation on the updated value happens here so errors clear as
   * soon as the value satisfies the constraint.
   */
  const handleChange = (
    field: keyof FormValues,
    value: FormValues[keyof FormValues]
  ): void => {
    setValues((prev) => ({ ...prev, [field]: value }));

    // Clear error for this field if the new value is now valid (Req 7.4).
    const errorMessage = validateField(field, value);
    setErrors((prev) => {
      if (!errorMessage && prev[field]) {
        // Value is valid — remove the stale error entry.
        const updated = { ...prev };
        delete updated[field];
        return updated;
      }
      return prev;
    });
  };

  /**
   * Marks a field as touched and runs per-field validation so an error
   * appears immediately when the user leaves an invalid field (Req 7.1, 7.2).
   */
  const handleBlur = (field: keyof FormValues): void => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    const errorMessage = validateField(field, values[field]);
    setErrors((prev) => {
      if (errorMessage) {
        return { ...prev, [field]: errorMessage };
      }
      // Field is valid — clear any existing error (Req 7.4).
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  };

  /**
   * Validates all fields and submits the form to the API.
   *
   * Flow:
   * 1. Prevent default browser submission.
   * 2. Run full validation; mark all fields touched so errors render.
   *    If invalid, scroll to the first field with an error and bail out.
   * 3. Set isSubmitting = true and clear any prior submitError.
   * 4. Read the JWT from localStorage (key: hostnexus_token).
   * 5. POST to /api/resources with Authorization: Bearer {token}.
   *    Optional fields (description, unit, location) are omitted from the
   *    body when their value is an empty string (Req 8.3).
   * 6. Handle response status codes:
   *    - 201 → call onSuccess callback (Req 9.1)
   *    - 400 → show server validation error message (Req 9.6)
   *    - 401 → "Session expired. Please log in again." (Req 9.7)
   *    - 403 → "No business account found. Please contact support." (Req 9.9)
   *    - other → generic fallback (Req 9.7)
   * 7. Always set isSubmitting = false in finally (Req 8.9).
   *
   * Requirements: 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.8, 8.9, 9.1, 9.6, 9.7, 9.9
   */
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    // ── Step 1: Full validation ──────────────────────────────────────────────
    const formErrors = validateForm();
    const hasErrors = Object.keys(formErrors).length > 0;

    // Mark every field as touched so errors are shown to the user (Req 7.5).
    const allTouched: FormTouched = {
      name: true,
      resourceType: true,
      description: true,
      quantity: true,
      unit: true,
      location: true,
      isActive: true,
    };
    setTouched(allTouched);

    if (hasErrors) {
      setErrors(formErrors);

      // Scroll to the first invalid field (Req 7.6).
      // Field names map directly to their input `name` / `id` attributes.
      const fieldOrder: Array<keyof FormErrors> = [
        "resourceType",
        "name",
        "description",
        "quantity",
        "unit",
        "location",
        "isActive",
      ];
      for (const field of fieldOrder) {
        if (formErrors[field]) {
          const el = document.querySelector<HTMLElement>(
            `[name="${field}"], [id="${field}"]`
          );
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.focus({ preventScroll: true });
          }
          break;
        }
      }
      return;
    }

    // ── Step 2: Submission ───────────────────────────────────────────────────
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("hostnexus_token")
          : null;

      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

      const response = await fetch(`${apiBase}/api/resources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: values.name,
          resourceType: values.resourceType,
          // Optional fields: send undefined (omitted) when empty (Req 8.3).
          description: values.description || undefined,
          quantity: values.quantity,
          unit: values.unit || undefined,
          location: values.location || undefined,
          isActive: values.isActive,
          status: "available",
        }),
      });

      if (response.status === 201) {
        // Success — invoke the caller's callback (Req 9.1).
        options.onSuccess?.();
        return;
      }

      // Non-success branch — parse error body where possible.
      let errorMessage: string;

      if (response.status === 401) {
        errorMessage = "Session expired. Please log in again.";
      } else if (response.status === 403) {
        errorMessage =
          "No business account found. Please contact support.";
      } else if (response.status === 400) {
        // Try to surface the server's validation message (Req 9.6).
        try {
          const data = await response.json();
          errorMessage =
            data?.error?.message ??
            data?.message ??
            "Failed to create resource. Please try again.";
        } catch {
          errorMessage = "Failed to create resource. Please try again.";
        }
      } else {
        // Generic fallback for any other status code (Req 9.7).
        try {
          const data = await response.json();
          errorMessage =
            data?.error?.message ??
            data?.message ??
            "Failed to create resource. Please try again.";
        } catch {
          errorMessage = "Failed to create resource. Please try again.";
        }
      }

      setSubmitError(errorMessage);
    } catch {
      // Network-level or unexpected errors.
      setSubmitError("Failed to create resource. Please try again.");
    } finally {
      // Always restore interactive state (Req 8.9).
      setIsSubmitting(false);
    }
  };

  /**
   * Resets all form state back to defaults.
   *
   * - values  → DEFAULT_VALUES (isDirty becomes false automatically since it's derived)
   * - errors  → {}
   * - touched → {}
   * - submitError → null
   *
   * Requirements: 3.4 (task), 14.1 (isDirty clears on reset)
   */
  const resetForm = (): void => {
    setValues(DEFAULT_VALUES);
    setErrors({});
    setTouched({});
    setSubmitError(null);
  };

  return {
    values,
    errors,
    touched,
    isSubmitting,
    submitError,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    validateField,
    validateForm,
  };
}
