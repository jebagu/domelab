export const groupPalette = [
  "#5eead4",
  "#60a5fa",
  "#f472b6",
  "#facc15",
  "#a78bfa",
  "#fb7185",
  "#34d399",
  "#f97316",
  "#38bdf8",
  "#e879f9",
  "#bef264",
  "#fda4af"
];

export const colorForIndex = (index: number): string => groupPalette[index % groupPalette.length];

export const valenceColor = (valence: number): string => {
  if (valence <= 3) return "#f97316";
  if (valence === 4) return "#facc15";
  if (valence === 5) return "#60a5fa";
  if (valence === 6) return "#5eead4";
  return "#f472b6";
};
