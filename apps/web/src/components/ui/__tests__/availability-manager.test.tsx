/**
 * The availability windows an owner picks must reach the API, even when they
 * never click "Add Window" — otherwise the listing's calendar shows no
 * available (green) days to renters.
 */
import { createRef } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, beforeEach, describe, it, expect } from "vitest";
import AvailabilityManager, { type AvailabilityManagerHandle } from "../availability-manager";
import { AuthService } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({ AuthService: { fetchWithAuth: vi.fn() } }));

const fetchWithAuth = AuthService.fetchWithAuth as unknown as ReturnType<typeof vi.fn>;

/** What the API received in the PUT /availability body */
function sentWindows(): Array<{ fromDate: string; toDate: string; note?: string }> {
  const [, init] = fetchWithAuth.mock.calls.at(-1)!;
  return JSON.parse((init as RequestInit).body as string).windows;
}

function dateInputs() {
  return document.querySelectorAll<HTMLInputElement>('input[type="date"]');
}

beforeEach(() => {
  fetchWithAuth.mockReset();
  fetchWithAuth.mockImplementation(async (_url: string, init?: RequestInit) => {
    const windows = JSON.parse((init?.body as string) ?? '{"windows":[]}').windows;
    return {
      ok: true,
      json: async () => ({ success: true, data: { windows: windows.map((w: object, i: number) => ({ id: `w${i}`, ...w })) } }),
    } as Response;
  });
});

async function save(ref: React.RefObject<AvailabilityManagerHandle | null>) {
  await act(async () => {
    await ref.current!.saveToApi("res-1");
  });
}

describe("AvailabilityManager.saveToApi", () => {
  it("saves the range the owner picked even if they never clicked Add Window", async () => {
    const ref = createRef<AvailabilityManagerHandle>();
    render(<AvailabilityManager ref={ref} />);
    const [from, to] = dateInputs();
    fireEvent.change(from, { target: { value: "2030-10-01" } });
    fireEvent.change(to, { target: { value: "2030-10-20" } });

    await save(ref);

    expect(fetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining("/api/resources/res-1/availability"),
      expect.objectContaining({ method: "PUT" })
    );
    expect(sentWindows()).toEqual([
      expect.objectContaining({ fromDate: "2030-10-01T00:00:00.000Z", toDate: "2030-10-20T00:00:00.000Z" }),
    ]);
  });

  it("saves the range shown when no window was added at all", async () => {
    const ref = createRef<AvailabilityManagerHandle>();
    render(<AvailabilityManager ref={ref} />);
    await save(ref);
    expect(sentWindows()).toHaveLength(1);
  });

  it("does not add the draft twice once it was added", async () => {
    const ref = createRef<AvailabilityManagerHandle>();
    render(<AvailabilityManager ref={ref} />);
    const [from, to] = dateInputs();
    fireEvent.change(from, { target: { value: "2030-10-01" } });
    fireEvent.change(to, { target: { value: "2030-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: /add window/i }));

    await save(ref);

    // The added window, and nothing for the untouched reset draft
    expect(sentWindows()).toEqual([expect.objectContaining({ fromDate: "2030-10-01T00:00:00.000Z" })]);
  });

  it("surfaces a failed save to the caller instead of hiding it", async () => {
    fetchWithAuth.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "You can only manage your own resources" } }),
    } as Response);
    const ref = createRef<AvailabilityManagerHandle>();
    render(<AvailabilityManager ref={ref} />);
    await expect(ref.current!.saveToApi("res-1")).rejects.toThrow("You can only manage your own resources");
  });
});
