import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { WeatherImpactPanel } from "../weather-impact-panel";
import { getBookingWeather, type BookingWeatherCheck } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({ getBookingWeather: vi.fn() }));
const mockGet = vi.mocked(getBookingWeather);

const day = (date: string, over = {}) => ({
  date, summary: "Clear sky", emoji: "☀️", tempMaxC: 31, tempMinC: 22, precipMm: 0,
  precipProbability: 5, windMaxKmh: 12, uvIndexMax: 6, thunder: false, ...over,
});

function check(over: Partial<BookingWeatherCheck> = {}): BookingWeatherCheck {
  return {
    resourceId: "res-1", resourceType: "Tent/Canopy", location: "Pune", source: "Open-Meteo",
    fetchedAt: "2026-10-01T04:30:00Z", startDate: "2026-10-02", endDate: "2026-10-03", horizonEnd: "2026-10-16",
    coverage: "full",
    days: [day("2026-10-02"), day("2026-10-03", { summary: "Thunderstorm", emoji: "⛈️", precipMm: 40, precipProbability: 90, thunder: true })],
    transport: { relevant: true, mode: "PROVIDER", ownerProvides: true, dates: ["2026-10-02", "2026-10-03"] },
    overall: "high",
    impacts: [
      { area: "rental", level: "high", title: "Rain load on the tent", detail: "Rain is forecast on Sat, 3 Oct.", dates: ["2026-10-03"] },
      { area: "transport", level: "high", title: "Heavy rain on a transport day", detail: "The owner's delivery or return on Sat, 3 Oct may be delayed.", dates: ["2026-10-03"] },
    ],
    ...over,
  };
}

beforeEach(() => mockGet.mockReset());

it("stays hidden until both dates are picked", () => {
  const { container } = render(<WeatherImpactPanel resourceId="res-1" startDate="2026-10-02" endDate="" transportMode="SELF" />);
  expect(container).toBeEmptyDOMElement();
  expect(mockGet).not.toHaveBeenCalled();
});

it("shows rental and transport impacts for the chosen dates", async () => {
  mockGet.mockResolvedValue({ ok: true, check: check() });
  render(<WeatherImpactPanel resourceId="res-1" startDate="2026-10-02" endDate="2026-10-03" transportMode="PROVIDER" />);

  expect(await screen.findByText("Rain load on the tent")).toBeInTheDocument();
  expect(screen.getByText("Impact on the rental")).toBeInTheDocument();
  expect(screen.getByText("Impact on the owner's transport")).toBeInTheDocument();
  expect(screen.getByText("High impact")).toBeInTheDocument();
  expect(screen.getByText(/Weather check · Pune/)).toBeInTheDocument();
  expect(mockGet).toHaveBeenCalledWith("res-1", "2026-10-02", "2026-10-03", "PROVIDER", expect.any(AbortSignal));
});

it("says so when there is nothing to worry about", async () => {
  mockGet.mockResolvedValue({ ok: true, check: check({ overall: "none", impacts: [], days: [day("2026-10-02")] }) });
  render(<WeatherImpactPanel resourceId="res-1" startDate="2026-10-02" endDate="2026-10-02" transportMode="PROVIDER" />);
  expect(await screen.findByText(/No weather issues expected/)).toBeInTheDocument();
});

it("explains dates beyond the forecast", async () => {
  mockGet.mockResolvedValue({ ok: true, check: check({ coverage: "none", days: [], impacts: [], overall: "none", lastYear: [day("2025-12-20")] }) });
  render(<WeatherImpactPanel resourceId="res-1" startDate="2026-12-20" endDate="2026-12-20" transportMode="SELF" />);
  expect(await screen.findByText(/beyond the forecast/)).toBeInTheDocument();
  expect(screen.getByText(/Same dates last year/)).toBeInTheDocument();
});

it("reports when the weather service is down", async () => {
  mockGet.mockResolvedValue({ ok: false, reason: "UNAVAILABLE", location: "Pune" });
  render(<WeatherImpactPanel resourceId="res-1" startDate="2026-10-02" endDate="2026-10-02" transportMode="SELF" />);
  await waitFor(() => expect(screen.getByText(/weather service is unavailable/)).toBeInTheDocument());
});
