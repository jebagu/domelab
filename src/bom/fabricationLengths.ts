import type { ConnectorSystem, Edge, EndCondition, ProjectState, ValidationMessage } from "../types";

export const applyFabricationRules = (
  edges: Edge[],
  state: ProjectState
): { edges: Edge[]; warnings: ValidationMessage[] } => {
  const warnings: ValidationMessage[] = [];
  const connector = state.connectorSystem;

  const processed = edges.map((edge) => {
    const { cutLengthM, fabricationLengthM, endCondition } = calculateLengths(edge.modelLengthM, connector, state);

    if (cutLengthM <= 0) {
      warnings.push({
        level: "error",
        code: "negative-cut-length",
        message: `Connector offsets create a non-positive cut length for ${edge.id}.`
      });
    }

    return {
      ...edge,
      fabricationLengthM,
      cutLengthM,
      connectorSystem: connector,
      endConditionA: endCondition,
      endConditionB: endCondition
    };
  });

  return { edges: processed, warnings };
};

const calculateLengths = (
  modelLengthM: number,
  connector: ConnectorSystem,
  state: ProjectState
): { fabricationLengthM: number; cutLengthM: number; endCondition: EndCondition } => {
  if (connector === "flattened-drilled-bolted") {
    const settings = state.connectors.flattenedBolted;
    const fabricationLengthM = modelLengthM;
    const cutLengthM =
      fabricationLengthM + (2 * settings.holeOffsetMm + settings.flattenCompensationMm) / 1000;
    return {
      fabricationLengthM,
      cutLengthM,
      endCondition: {
        type: "flat-drilled",
        holeDiameterMm: settings.holeDiameterMm,
        holeOffsetMm: settings.holeOffsetMm
      }
    };
  }

  if (connector === "ball-hub") {
    const settings = state.connectors.ballHub;
    const fabricationLengthM = modelLengthM;
    const cutLengthM = fabricationLengthM - (2 * settings.socketSeatOffsetMm) / 1000 + settings.trimAllowanceMm / 1000;
    return {
      fabricationLengthM,
      cutLengthM,
      endCondition: {
        type: "socket",
        socketSeatOffsetMm: settings.socketSeatOffsetMm
      }
    };
  }

  const settings = state.connectors.weldedNode;
  const fabricationLengthM = modelLengthM;
  const cutLengthM = fabricationLengthM - (2 * settings.weldSetbackMm) / 1000 + settings.copeAllowanceMm / 1000;
  return {
    fabricationLengthM,
    cutLengthM,
    endCondition: {
      type: "welded-cope",
      copeAngleDeg: 90,
      bevelDeg: settings.bevelDeg
    }
  };
};
