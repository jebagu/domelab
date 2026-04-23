import type { Units } from "../types";

export const metersToDisplay = (meters: number | null, units: Units): string => {
  if (meters === null || !Number.isFinite(meters)) return "—";
  if (units === "imperial") {
    const totalInches = meters * 39.3700787402;
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches - feet * 12;
    return `${feet}' ${inches.toFixed(1)}"`;
  }
  if (meters < 1) return `${(meters * 1000).toFixed(0)} mm`;
  return `${meters.toFixed(3)} m`;
};

export const metersToInputValue = (meters: number, units: Units): number =>
  units === "imperial" ? Number((meters * 3.280839895).toFixed(3)) : Number(meters.toFixed(3));

export const inputValueToMeters = (value: number, units: Units): number =>
  units === "imperial" ? value / 3.280839895 : value;

export const currency = (value: number, code: string): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code || "USD",
      maximumFractionDigits: 0
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return number(Number.isFinite(value) ? value : 0);
  }
};

export const number = (value: number, digits = 0): string =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);

export const percent = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? "—" : `${number(value, 1)}%`;
