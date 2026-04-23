import type { BuiltProject, ProjectState } from "../types";
import { configurationSummaryLine, patternKindLabel, surfaceKindLabel, surfacePrimaryDiameterM } from "../configuration";

export const createBomCsv = (built: BuiltProject, state: ProjectState): string => {
  const lines: string[][] = [
    ["Dome Lab BOM"],
    ["Structural disclaimer", "This BOM is a geometric and fabrication estimate. It is not a structural engineering certification."],
    [],
    ["Settings"],
    ["Surface geometry", surfaceKindLabel(state.surface.kind)],
    ["Pattern / structural family", patternKindLabel(state.pattern.kind)],
    ["Node treatment", state.nodes.kind],
    ["Connector system", state.connectorSystem],
    ["Primary diameter (m)", surfacePrimaryDiameterM(state.surface).toString()],
    ["Summary", configurationSummaryLine(state)],
    [],
    [
      "Strut group",
      "Qty",
      "Model length (m)",
      "Fabrication reference length (m)",
      "Cut length (m)",
      "Role",
      "End treatment",
      "Estimated cost"
    ],
    ...built.bom.strutGroups.map((group) => [
      group.label,
      group.quantity.toString(),
      group.modelLengthM.toFixed(4),
      group.fabricationLengthM.toFixed(4),
      group.cutLengthM.toFixed(4),
      group.role,
      group.endTreatment,
      costCell(group.estimatedCost, state)
    ]),
    ...referencePartRows(state),
    [],
    ["Node group", "Qty", "Valence", "Role", "Connector", "Estimated cost", "Fabrication note"],
    ...built.bom.nodeGroups.map((group) => [
      group.label,
      group.quantity.toString(),
      group.valence.toString(),
      group.role,
      group.connectorSystem,
      costCell(group.estimatedCost, state),
      group.fabricationNote
    ]),
    [],
    ["Cost component", "Amount"],
    ["Strut material", costCell(built.bom.costs.material, state)],
    ["End operations", costCell(built.bom.costs.endOperations, state)],
    ["Connector/node material", costCell(built.bom.costs.nodeConnectors, state)],
    ["Hardware", costCell(built.bom.costs.hardware, state)],
    ["Welding", costCell(built.bom.costs.welding, state)],
    ["Setup", costCell(built.bom.costs.setup, state)],
    ["Contingency", costCell(built.bom.costs.contingency, state)],
    ["Total", costCell(built.bom.costs.total, state)]
  ];

  return lines.map((line) => line.map(escapeCsv).join(",")).join("\n");
};

const costCell = (value: number | null, _state: ProjectState): string => (value === null ? "—" : value.toFixed(2));

const referencePartRows = (state: ProjectState): string[][] => {
  const parts = state.reference?.parts ?? [];
  if (parts.length === 0) return [];
  return [
    [],
    ["Reference part schedule", state.reference?.sourceLabel ?? ""],
    ["Reference note", state.reference?.note ?? ""],
    ...parameterRows("Known parameters", state.reference?.knownParameters ?? []),
    ...parameterRows("Unknown parameters", state.reference?.unknownParameters ?? []),
    ...parameterRows("Pricing summary", state.reference?.pricingSummary ?? []),
    [
      "ID",
      "Description",
      "Sphere qty",
      "Spares",
      "Total qty",
      "Cut/strut length (mm)",
      "Reference/hole spacing (mm)",
      "Bend angle",
      "End 1 angle",
      "End 2 angle",
      "Color",
      "Tube type",
      "Unit price (USD)",
      "Line total (USD)"
    ],
    ...parts.map((part) => [
      part.id,
      part.description,
      part.quantity.toString(),
      part.spares?.toString() ?? "",
      part.totalQuantity?.toString() ?? "",
      Math.round(part.cutLengthM * 1000).toString(),
      part.fabricationLengthM ? Math.round(part.fabricationLengthM * 1000).toString() : "",
      part.bendAngleDeg?.toString() ?? "",
      part.endAngleADeg?.toString() ?? "",
      part.endAngleBDeg?.toString() ?? "",
      part.color ?? "",
      part.tubeType ?? "",
      part.unitPriceUsd?.toFixed(2) ?? "",
      part.lineTotalUsd?.toFixed(2) ?? ""
    ])
  ];
};

const parameterRows = (label: string, items: string[]): string[][] =>
  items.length ? [[label], ...items.map((item) => ["", item])] : [];

export const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const downloadTextFile = (filename: string, content: string, type: string) => {
  downloadBlob(filename, new Blob([content], { type }));
};

const escapeCsv = (value: string): string => {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
};
