import type { Edge, ProjectState, StrutGroup } from "../types";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const groupStruts = (edges: Edge[], state: ProjectState): StrutGroup[] => {
  const toleranceM = state.project.lengthGroupToleranceMm / 1000;
  const groups = new Map<string, Edge[]>();

  edges.forEach((edge) => {
    const roundedLength = roundToTolerance(edge.cutLengthM, toleranceM);
    const key = [
      state.pattern.kind,
      state.material.materialName,
      state.material.profileLabel,
      edge.connectorSystem,
      edge.role,
      roundedLength.toFixed(6),
      endTreatmentKey(edge, state)
    ].join("|");
    const list = groups.get(key) ?? [];
    list.push(edge);
    groups.set(key, list);
  });

  return [...groups.entries()]
    .sort(([, a], [, b]) => a[0].cutLengthM - b[0].cutLengthM)
    .map(([key, list], index) => {
      const representative = list[0];
      const materialLength = list.reduce((sum, edge) => sum + edge.cutLengthM, 0);
      const estimatedCost =
        state.material.costPerMeter === null ? null : materialLength * state.material.costPerMeter;
      return {
        id: key,
        label: labelFor(index),
        quantity: list.length,
        modelLengthM: average(list.map((edge) => edge.modelLengthM)),
        fabricationLengthM: average(list.map((edge) => edge.fabricationLengthM)),
        cutLengthM: roundToTolerance(representative.cutLengthM, toleranceM),
        edgeIds: list.map((edge) => edge.id),
        materialProfileId: representative.materialProfileId,
        connectorSystem: representative.connectorSystem,
        estimatedCost,
        role: representative.role,
        endTreatment: endTreatmentLabel(representative.connectorSystem)
      };
    });
};

export const roundToTolerance = (value: number, tolerance: number): number => {
  if (tolerance <= 0) return value;
  return Math.round(value / tolerance) * tolerance;
};

const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

const labelFor = (index: number): string => {
  let value = index;
  let label = "";
  do {
    label = alphabet[value % alphabet.length] + label;
    value = Math.floor(value / alphabet.length) - 1;
  } while (value >= 0);
  return label;
};

const endTreatmentKey = (edge: Edge, state: ProjectState): string => {
  if (edge.connectorSystem === "flattened-drilled-bolted") {
    const settings = state.connectors.flattenedBolted;
    return `hole-${settings.holeDiameterMm}|flatten-${settings.flattenLengthMm}`;
  }
  if (edge.connectorSystem === "ball-hub") {
    const settings = state.connectors.ballHub;
    return `socket-${settings.socketSeatOffsetMm}|ball-${settings.ballDiameterMm}`;
  }
  const settings = state.connectors.weldedNode;
  return `cope-${settings.copeAllowanceMm}|bevel-${settings.bevelDeg}`;
};

const endTreatmentLabel = (connector: Edge["connectorSystem"]): string => {
  if (connector === "flattened-drilled-bolted") return "Flattened, drilled, bolted ends";
  if (connector === "ball-hub") return "Socket/adapter ends for ball hub";
  return "Coped, beveled welded ends";
};
