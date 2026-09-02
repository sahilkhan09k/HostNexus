/**
 * Unit tests for ResourceForm component.
 * Requirements: 2.1, 3.1, 3.5, 4.1, 5.1, 9.2, 9.3, 9.4
 *
 * The useResourceForm hook is mocked so tests cover only the UI rendering
 * and interaction layer without triggering real validation / API calls.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import ResourceForm from "../resource-form";
import { useResourceForm } from "../../_hooks/use-resource-form";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("lucide-react", () => ({
  AlertCircle: () => null,
  Loader2: () => null,
  X: () => null,
  CheckCircle2: () => null,
}));

vi.mock("../../_hooks/use-resource-form", () => ({
  useResourceForm: vi.fn(),
}));

// ── Default mock return value ─────────────────────────────────────────────────

const mockHandleChange = vi.fn();
const mockHandleBlur = vi.fn();
const mockHandleSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
const mockResetForm = vi.fn();
const mockValidateField = vi.fn();
const mockValidateForm = vi.fn();

const defaultMockReturn = {
  values: {
    name: "",
    resourceType: "",
    description: "",
    quantity: 1,
    unit: "",
    location: "",
    isActive: true,
  },
  errors: {},
  touched: {},
  isSubmitting: false,
  submitError: null,
  isDirty: false,
  handleChange: mockHandleChange,
  handleBlur: mockHandleBlur,
  handleSubmit: mockHandleSubmit,
  resetForm: mockResetForm,
  validateField: mockValidateField,
  validateForm: mockValidateForm,
};

// Helper to configure the mock before each test
function setupMock(overrides: Partial<typeof defaultMockReturn> = {}) {
  (useResourceForm as ReturnType<typeof vi.fn>).mockReturnValue({
    ...defaultMockReturn,
    ...overrides,
    values: { ...defaultMockReturn.values, ...(overrides.values ?? {}) },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ResourceForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock();
  });

  // 1. Heading
  it("renders the 'Resource Details' heading", () => {
    render(<ResourceForm />);
    expect(screen.getByText("Resource Details")).toBeInTheDocument();
  });

  // 2. All 7 form fields present
  it("renders all 7 form fields", () => {
    render(<ResourceForm />);

    expect(screen.getByRole("combobox", { name: /resource category/i })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /available quantity/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /resource name/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /description/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /unit/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /location/i })).toBeInTheDocument();
    // Toggle is a switch button
    expect(screen.getByRole("switch", { name: /list on marketplace/i })).toBeInTheDocument();
  });

  // 3. All labels rendered
  it("renders all expected field labels", () => {
    render(<ResourceForm />);

    expect(screen.getByText(/resource category/i)).toBeInTheDocument();
    expect(screen.getByText(/resource name/i)).toBeInTheDocument();
    expect(screen.getByText(/description/i)).toBeInTheDocument();
    expect(screen.getByText(/available quantity/i)).toBeInTheDocument();
    expect(screen.getByText(/^unit/i)).toBeInTheDocument();
    expect(screen.getByText(/location/i)).toBeInTheDocument();
    expect(screen.getByText(/list on marketplace/i)).toBeInTheDocument();
  });

  // 4. Submit button
  it("renders the 'Create Resource' submit button", () => {
    render(<ResourceForm />);
    expect(screen.getByRole("button", { name: /create resource/i })).toBeInTheDocument();
  });

  // 5. Cancel button
  it("renders the 'Cancel' button", () => {
    render(<ResourceForm />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  // 6. Submit button shows "Creating..." when isSubmitting
  it("shows 'Creating...' on submit button when isSubmitting is true", () => {
    setupMock({ isSubmitting: true });
    render(<ResourceForm />);
    expect(screen.getByRole("button", { name: /creating/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^create resource$/i })).not.toBeInTheDocument();
  });

  // 7. Submit button disabled when isSubmitting
  it("disables submit button when isSubmitting is true", () => {
    setupMock({ isSubmitting: true });
    render(<ResourceForm />);
    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
  });

  // 8. All inputs disabled when isSubmitting
  it("disables all inputs when isSubmitting is true", () => {
    setupMock({ isSubmitting: true });
    render(<ResourceForm />);

    expect(screen.getByRole("combobox", { name: /resource category/i })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /resource name/i })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /description/i })).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: /available quantity/i })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /unit/i })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /location/i })).toBeDisabled();
    expect(screen.getByRole("switch", { name: /list on marketplace/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });

  // 9. Cancel button calls onCancel
  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<ResourceForm onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // 10. Error banner appears when submitError is set
  it("renders error banner when submitError is set", () => {
    setupMock({ submitError: "Failed to create resource. Please try again." });
    render(<ResourceForm />);
    expect(
      screen.getByText("Failed to create resource. Please try again.")
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  // 11. Error banner can be dismissed
  it("dismisses the error banner when the X button is clicked", async () => {
    setupMock({ submitError: "Some error occurred." });
    render(<ResourceForm />);

    expect(screen.getByText("Some error occurred.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dismiss error/i }));

    await waitFor(() => {
      expect(screen.queryByText("Some error occurred.")).not.toBeInTheDocument();
    });
  });

  // 12. Character counter shows "0/1000" initially
  it("shows character counter '0/1000' when description is empty", () => {
    render(<ResourceForm />);
    expect(screen.getByText("0/1000")).toBeInTheDocument();
  });

  // 13. Character counter updates as description changes
  it("updates character counter when description value changes", () => {
    setupMock({ values: { ...defaultMockReturn.values, description: "Hello" } });
    render(<ResourceForm />);
    expect(screen.getByText("5/1000")).toBeInTheDocument();
  });

  // 14. Toggle changes isActive when clicked
  it("calls handleChange with toggled isActive when toggle is clicked", () => {
    render(<ResourceForm />);
    const toggle = screen.getByRole("switch", { name: /list on marketplace/i });
    // Default isActive = true, so clicking should call handleChange("isActive", false)
    fireEvent.click(toggle);
    expect(mockHandleChange).toHaveBeenCalledWith("isActive", false);
  });

  // 15. Default quantity value is 1
  it("renders quantity input with default value of 1", () => {
    render(<ResourceForm />);
    const quantityInput = screen.getByRole("spinbutton", { name: /available quantity/i }) as HTMLInputElement;
    expect(quantityInput.value).toBe("1");
  });
});
