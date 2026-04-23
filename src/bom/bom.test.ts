import { describe, expect, it } from "vitest";
import { buildProject } from "../buildProject";
import { defaultProject } from "../data/defaultProject";
import { applyFabricationRules } from "./fabricationLengths";
import { groupStruts } from "./strutGrouping";
import type { Edge, ProjectState } from "../types";

const edge = (id: string, modelLengthM: number): Edge => ({
  id,
  nodeA: "n0",
  nodeB: "n1",
  role: "interior",
  modelLengthM,
  fabricationLengthM: modelLengthM,
  cutLengthM: modelLengthM,
  materialProfileId: "default-profile",
  connectorSystem: "flattened-drilled-bolted",
  endConditionA: { type: "plain-cut" },
  endConditionB: { type: "plain-cut" }
});

describe("BOM fabrication and grouping", () => {
  it("uses hole offset and flatten compensation for flattened bolted cut length", () => {
    const state: ProjectState = {
      ...defaultProject,
      connectorSystem: "flattened-drilled-bolted"
    };
    const result = applyFabricationRules([edge("e0", 1)], state).edges[0];

    expect(result.fabricationLengthM).toBeCloseTo(1);
    expect(result.cutLengthM).toBeCloseTo(1.046);
  });

  it("uses socket seat offset for ball hub cut length", () => {
    const state: ProjectState = {
      ...defaultProject,
      connectorSystem: "ball-hub"
    };
    const result = applyFabricationRules([edge("e0", 1)], state).edges[0];

    expect(result.cutLengthM).toBeCloseTo(0.948);
  });

  it("uses weld setback and cope allowance for welded cut length", () => {
    const state: ProjectState = {
      ...defaultProject,
      connectorSystem: "welded-node"
    };
    const result = applyFabricationRules([edge("e0", 1)], state).edges[0];

    expect(result.cutLengthM).toBeCloseTo(0.984);
  });

  it("strut grouping respects tolerance changes", () => {
    const stateTight = {
      ...defaultProject,
      project: { ...defaultProject.project, lengthGroupToleranceMm: 1 }
    };
    const stateLoose = {
      ...defaultProject,
      project: { ...defaultProject.project, lengthGroupToleranceMm: 10 }
    };
    const edges = [edge("a", 1), edge("b", 1.004)];

    expect(groupStruts(edges, stateTight)).toHaveLength(2);
    expect(groupStruts(edges, stateLoose)).toHaveLength(1);
  });

  it("total cost equals the visible components", () => {
    const built = buildProject(pricedProject());
    const costs = built.bom.costs;
    const visibleSum =
      (costs.material ?? 0) +
      (costs.endOperations ?? 0) +
      (costs.nodeConnectors ?? 0) +
      (costs.hardware ?? 0) +
      (costs.welding ?? 0) +
      (costs.finishing ?? 0) +
      (costs.waste ?? 0) +
      (costs.setup ?? 0) +
      (costs.contingency ?? 0);

    expect(costs.total).toBeCloseTo(visibleSum, 2);
  });

  it("empty cost assumptions produce blank money totals without missing-cost warnings", () => {
    const built = buildProject(defaultProject);

    expect(built.bom.costs.total).toBeNull();
    expect(built.bom.strutGroups.every((group) => group.estimatedCost === null)).toBe(true);
    expect(built.bom.nodeGroups.every((group) => group.estimatedCost === null)).toBe(true);
    expect(built.bom.warnings.some((warning) => warning.code === "missing-material-cost")).toBe(false);
    expect(built.bom.warnings.some((warning) => warning.code === "missing-operation-cost")).toBe(false);
  });

  it("node valence counts are populated", () => {
    const built = buildProject(defaultProject);
    expect(built.geometry.nodes.every((node) => node.valence === node.incidentEdgeIds.length)).toBe(true);
    expect(built.bom.nodeGroups.length).toBeGreaterThan(0);
  });
});

const pricedProject = (): ProjectState => ({
  ...defaultProject,
  material: {
    ...defaultProject.material,
    materialName: "Steel",
    profileLabel: "25 mm round tube",
    costPerMeter: 5.8,
    stockLengthM: 6,
    wasteFactor: 1.08,
    endOperationCostPerEnd: 0.85,
    nodeBaseCost: 2.25,
    nodePerStrutAdder: 0.35,
    setupCost: 45,
    contingencyPercent: 8
  }
});
