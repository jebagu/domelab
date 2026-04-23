import Decimal from "decimal.js";
import type { CostBreakdown, NodeGroup, OperationCounts, ProjectState, StrutGroup } from "../types";
import { hasCostAssumptions } from "./costData";

export const calculateCosts = (
  strutGroups: StrutGroup[],
  nodeGroups: NodeGroup[],
  operations: OperationCounts,
  state: ProjectState
): CostBreakdown => {
  if (!hasCostAssumptions(state)) return blankCosts();
  const {
    costPerMeter,
    wasteFactor,
    endOperationCostPerEnd,
    setupCost,
    contingencyPercent
  } = state.material as {
    costPerMeter: number;
    wasteFactor: number;
    endOperationCostPerEnd: number;
    setupCost: number;
    contingencyPercent: number;
  };

  const rawMaterial = strutGroups.reduce(
    (sum, group) => sum.plus(new Decimal(group.cutLengthM).times(group.quantity).times(costPerMeter)),
    new Decimal(0)
  );
  const materialWithWaste = rawMaterial.times(wasteFactor);
  const waste = materialWithWaste.minus(rawMaterial);
  const totalEnds = operations.flattenedEnds || operations.sockets || operations.weldEnds || operations.copedEnds;
  const endOperations = new Decimal(totalEnds).times(endOperationCostPerEnd);
  const nodeConnectors = nodeGroups.reduce((sum, group) => sum.plus(group.estimatedCost ?? 0), new Decimal(0));
  const hardware = calculateHardware(operations, state);
  const welding =
    state.connectorSystem === "welded-node"
      ? new Decimal(operations.weldEnds).times(state.connectors.weldedNode.weldCostPerEnd)
      : new Decimal(0);
  const setup = new Decimal(setupCost);
  const subtotal = rawMaterial.plus(waste).plus(endOperations).plus(nodeConnectors).plus(hardware).plus(welding).plus(setup);
  const contingency = subtotal.times(contingencyPercent / 100);
  const total = subtotal.plus(contingency);

  return {
    material: number(rawMaterial),
    endOperations: number(endOperations),
    nodeConnectors: number(nodeConnectors),
    hardware: number(hardware),
    welding: number(welding),
    finishing: 0,
    waste: number(waste),
    setup: number(setup),
    contingency: number(contingency),
    total: number(total)
  };
};

const blankCosts = (): CostBreakdown => ({
  material: null,
  endOperations: null,
  nodeConnectors: null,
  hardware: null,
  welding: null,
  finishing: null,
  waste: null,
  setup: null,
  contingency: null,
  total: null
});

const calculateHardware = (operations: OperationCounts, state: ProjectState): Decimal => {
  if (state.connectorSystem === "flattened-drilled-bolted") {
    const settings = state.connectors.flattenedBolted;
    return new Decimal(operations.bolts)
      .times(settings.boltCost)
      .plus(new Decimal(operations.nuts).times(settings.nutCost))
      .plus(new Decimal(operations.washers).times(settings.washerCost));
  }
  if (state.connectorSystem === "ball-hub") {
    return new Decimal(operations.sockets).times(state.connectors.ballHub.socketAdapterCost);
  }
  return new Decimal(0);
};

const number = (value: Decimal): number => Number(value.toDecimalPlaces(2).toString());
