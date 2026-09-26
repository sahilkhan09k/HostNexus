"use client";

import { useState } from "react";
import { resourceFormSchema } from "@/schemas/resource.schema";
import { AuthService } from "@/lib/auth";

export interface FormValues {
  name: string;
  resourceType: string;
  description: string;
  quantity: number;
  unit: string;
  location: string;
  isActive: boolean;
  rentAmount: number;
  securityDeposit: number;
  photos: string[];
  hasPreExistingDamage: boolean;
  damageDescription: string;
  damagePhotos: string[];
  transportAvailable: boolean;
  transportRatePerKm: number;
}

export interface FormErrors {
  name?: string;
  resourceType?: string;
  description?: string;
  quantity?: string;
  unit?: string;
  location?: string;
  isActive?: string;
  rentAmount?: string;
  securityDeposit?: string;
  photos?: string;
  hasPreExistingDamage?: string;
  damageDescription?: string;
  damagePhotos?: string;
  transportAvailable?: string;
  transportRatePerKm?: string;
}

export type FormTouched = {
  [K in keyof FormValues]?: boolean;
};

const DEFAULT_VALUES: FormValues = {
  name: "",
  resourceType: "",
  description: "",
  quantity: 1,
  unit: "",
  location: "",
  isActive: true,
  rentAmount: 0,
  securityDeposit: 0,
  photos: [],
  hasPreExistingDamage: false,
  damageDescription: "",
  damagePhotos: [],
  transportAvailable: false,
  transportRatePerKm: 0,
};

export interface UseResourceFormOptions {
  onSuccess?: (resourceId?: string) => void;
  initialValues?: Partial<FormValues>;
  resourceId?: string; // If updating existing
}

export interface UseResourceFormReturn {
  values: FormValues;
  errors: FormErrors;
  touched: FormTouched;
  isSubmitting: boolean;
  submitError: string | null;
  isDirty: boolean;
  handleChange: (field: keyof FormValues, value: FormValues[keyof FormValues]) => void;
  handleBlur: (field: keyof FormValues) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  resetForm: () => void;
  validateField: (field: keyof FormValues, value: FormValues[keyof FormValues]) => string | undefined;
  validateForm: () => FormErrors;
}

export function useResourceForm(
  options: UseResourceFormOptions = {}
): UseResourceFormReturn {
  const initial = { ...DEFAULT_VALUES, ...options.initialValues };
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<FormTouched>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isDirty = (Object.keys(DEFAULT_VALUES) as Array<keyof FormValues>).some(
    (key) => values[key] !== initial[key]
  );

  const validateField = (
    field: keyof FormValues,
    value: FormValues[keyof FormValues]
  ): string | undefined => {
    const result = resourceFormSchema.safeParse({ ...values, [field]: value });
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === field);
      return issue?.message;
    }
    return undefined;
  };

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

  const handleChange = (
    field: keyof FormValues,
    value: FormValues[keyof FormValues]
  ): void => {
    setValues((prev) => ({ ...prev, [field]: value }));

    const errorMessage = validateField(field, value);
    setErrors((prev) => {
      if (!errorMessage && prev[field]) {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      }
      return prev;
    });
  };

  const handleBlur = (field: keyof FormValues): void => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    const errorMessage = validateField(field, values[field]);
    setErrors((prev) => {
      if (errorMessage) {
        return { ...prev, [field]: errorMessage };
      }
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    const formErrors = validateForm();
    const hasErrors = Object.keys(formErrors).length > 0;

    const allTouched: FormTouched = {
      name: true,
      resourceType: true,
      description: true,
      quantity: true,
      unit: true,
      location: true,
      isActive: true,
      rentAmount: true,
      securityDeposit: true,
      photos: true,
      hasPreExistingDamage: true,
      damageDescription: true,
      damagePhotos: true,
      transportAvailable: true,
      transportRatePerKm: true,
    };
    setTouched(allTouched);

    if (hasErrors) {
      setErrors(formErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
      const isEdit = Boolean(options.resourceId);
      const endpoint = isEdit
        ? `${apiBase}/api/resources/${options.resourceId}`
        : `${apiBase}/api/resources`;

      const payload = {
        name: values.name,
        resourceType: values.resourceType,
        description: values.description || undefined,
        quantity: values.quantity,
        unit: values.unit || undefined,
        location: values.location || undefined,
        isActive: values.isActive,
        status: "available",
        rentAmountPaise: Math.round(Number(values.rentAmount) * 100),
        securityDepositPaise: Math.round(Number(values.securityDeposit) * 100),
        photos: values.photos,
        hasPreExistingDamage: values.hasPreExistingDamage,
        damageDescription: values.hasPreExistingDamage ? values.damageDescription : undefined,
        damagePhotos: values.hasPreExistingDamage ? values.damagePhotos : [],
        transportAvailable: values.transportAvailable,
        transportRatePerKmPaise: values.transportAvailable
          ? Math.round(Number(values.transportRatePerKm) * 100)
          : 0,
      };

      const response = await AuthService.fetchWithAuth(endpoint, {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 201 || (isEdit && response.ok)) {
        const body = await response.json().catch(() => ({}));
        const newId: string | undefined = body?.data?.resource?.id ?? options.resourceId;
        options.onSuccess?.(newId);
        return;
      }

      let errorMessage = "Failed to save resource.";
      try {
        const data = await response.json();
        errorMessage = data?.error?.message ?? data?.message ?? errorMessage;
      } catch {
        // Fallback
      }

      setSubmitError(errorMessage);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to save resource. Please check connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = (): void => {
    setValues(initial);
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
