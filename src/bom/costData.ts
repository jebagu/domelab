import type { ProjectState } from "../types";

export const hasCostAssumptions = (state: ProjectState): boolean =>
  [
    state.material.costPerMeter,
    state.material.wasteFactor,
    state.material.endOperationCostPerEnd,
    state.material.nodeBaseCost,
    state.material.nodePerStrutAdder,
    state.material.setupCost,
    state.material.contingencyPercent
  ].every(isFiniteNumber);

export const hasStockLength = (state: ProjectState): boolean => isFiniteNumber(state.material.stockLengthM);

const isFiniteNumber = (value: number | null): value is number =>
  typeof value === "number" && Number.isFinite(value);
