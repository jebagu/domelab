import type { ConnectorSystem, OperationCounts } from "../types";

export const calculateOperationCounts = (totalStruts: number, connector: ConnectorSystem): OperationCounts => {
  const ends = totalStruts * 2;
  const base: OperationCounts = {
    cuts: totalStruts,
    flattenedEnds: 0,
    drilledHoles: 0,
    tappedHoles: 0,
    weldEnds: 0,
    copedEnds: 0,
    bolts: 0,
    nuts: 0,
    washers: 0,
    sockets: 0,
    inserts: 0,
    clamps: 0
  };

  if (connector === "flattened-drilled-bolted") {
    return {
      ...base,
      flattenedEnds: ends,
      drilledHoles: ends,
      bolts: ends,
      nuts: ends,
      washers: ends * 2
    };
  }

  if (connector === "ball-hub") {
    return {
      ...base,
      tappedHoles: ends,
      sockets: ends,
      inserts: ends
    };
  }

  return {
    ...base,
    weldEnds: ends,
    copedEnds: ends
  };
};
