import type { BomResult, GeometryResult, ProjectState, ValidationMessage } from "../types";
import { calculateCosts } from "./costs";
import { applyFabricationRules } from "./fabricationLengths";
import { groupNodes } from "./nodeGrouping";
import { calculateOperationCounts } from "./operationCounts";
import { optimizeStock } from "./stockOptimizer";
import { groupStruts } from "./strutGrouping";
import { measureSync } from "../utils/debug";

export const buildBom = (geometry: GeometryResult, state: ProjectState): { geometry: GeometryResult; bom: BomResult } => {
  const fabrication = measureSync("bom", "apply-fabrication-rules", () => applyFabricationRules(geometry.edges, state), {
    edgeCount: geometry.edges.length,
    connectorSystem: state.connectorSystem
  });
  const processedGeometry = { ...geometry, edges: fabrication.edges };
  const strutGroups = measureSync("bom", "group-struts", () => groupStruts(processedGeometry.edges, state), {
    edgeCount: processedGeometry.edges.length
  });
  const nodeGroups = measureSync("bom", "group-nodes", () => groupNodes(processedGeometry.nodes, state), {
    nodeCount: processedGeometry.nodes.length
  });
  const operationCounts = measureSync(
    "bom",
    "calculate-operations",
    () => calculateOperationCounts(processedGeometry.edges.length, state.connectorSystem),
    { edgeCount: processedGeometry.edges.length, connectorSystem: state.connectorSystem }
  );
  const stock = measureSync("bom", "optimize-stock", () => optimizeStock(strutGroups, state.material.stockLengthM), {
    groupCount: strutGroups.length,
    stockLengthM: state.material.stockLengthM
  });
  const costs = measureSync("bom", "calculate-costs", () => calculateCosts(strutGroups, nodeGroups, operationCounts, state), {
    strutGroupCount: strutGroups.length,
    nodeGroupCount: nodeGroups.length
  });
  const warnings = collectBomWarnings(state, processedGeometry, strutGroups, nodeGroups, [
    ...fabrication.warnings,
    ...stock.warnings
  ]);

  return {
    geometry: processedGeometry,
    bom: {
      strutGroups,
      nodeGroups,
      operationCounts,
      stockPlan: stock.plan,
      costs,
      totalStrutLengthM: processedGeometry.edges.reduce((sum, edge) => sum + edge.modelLengthM, 0),
      totalCutLengthM: processedGeometry.edges.reduce((sum, edge) => sum + edge.cutLengthM, 0),
      warnings
    }
  };
};

const collectBomWarnings = (
  state: ProjectState,
  geometry: GeometryResult,
  strutGroups: ReturnType<typeof groupStruts>,
  nodeGroups: ReturnType<typeof groupNodes>,
  warnings: ValidationMessage[]
): ValidationMessage[] => {
  const messages = [...warnings];
  if (strutGroups.length > 20) {
    messages.push({
      level: "warning",
      code: "many-unique-lengths",
      message: "Many unique strut length groups. Check tolerance and cut mode before fabrication."
    });
  }
  if (geometry.edges.some((edge) => edge.cutLengthM < 0.12)) {
    messages.push({
      level: "warning",
      code: "very-short-struts",
      message: "Some struts are very short and may be hard to fabricate."
    });
  }
  if (
    state.connectorSystem === "ball-hub" &&
    nodeGroups.some((group) => group.valence > state.connectors.ballHub.maxValence)
  ) {
    messages.push({
      level: "warning",
      code: "ball-valence-limit",
      message: "A ball node valence exceeds the configured maximum."
    });
  }
  if (
    state.connectorSystem === "flattened-drilled-bolted" &&
    state.connectors.flattenedBolted.holeOffsetMm < state.connectors.flattenedBolted.holeDiameterMm
  ) {
    messages.push({
      level: "warning",
      code: "hole-offset-close",
      message: "Flattened end hole offset is close to the tube end."
    });
  }
  return messages;
};
