import type { Node, NodeGroup, ProjectState } from "../types";

export const groupNodes = (nodes: Node[], state: ProjectState): NodeGroup[] => {
  const groups = new Map<string, Node[]>();
  nodes.forEach((node) => {
    const key = [
      state.connectorSystem,
      node.valence,
      node.role,
      state.material.materialName,
      connectorSpecificNodeKey(state)
    ].join("|");
    const list = groups.get(key) ?? [];
    list.push(node);
    groups.set(key, list);
  });

  return [...groups.entries()]
    .sort(([, a], [, b]) => a[0].valence - b[0].valence || a[0].role.localeCompare(b[0].role))
    .map(([key, list]) => {
      const representative = list[0];
      const unitCost = nodeUnitCost(representative.valence, state);
      return {
        id: key,
        label: nodeLabel(representative),
        quantity: list.length,
        valence: representative.valence,
        role: representative.role,
        connectorSystem: state.connectorSystem,
        nodeIds: list.map((node) => node.id),
        estimatedCost: unitCost === null ? null : unitCost * list.length,
        fabricationNote: nodeFabricationNote(representative.valence, state)
      };
    });
};

const nodeLabel = (node: Node): string => {
  if (node.role === "base") return `NB${node.valence}`;
  if (node.role === "crown") return `NC${node.valence}`;
  if (node.role === "boundary" || node.role === "cut") return `NT${node.valence}`;
  return `N${node.valence}`;
};

const connectorSpecificNodeKey = (state: ProjectState): string => {
  if (state.connectorSystem === "ball-hub") return `ball-${state.connectors.ballHub.ballDiameterMm}`;
  if (state.connectorSystem === "welded-node") return `shell-${state.connectors.weldedNode.nodeShellCost}`;
  return "plate-or-overlap";
};

const nodeUnitCost = (valence: number, state: ProjectState): number | null => {
  if (state.connectorSystem === "ball-hub") {
    if (state.material.nodeBaseCost === null) return null;
    return state.material.nodeBaseCost + state.connectors.ballHub.socketAdapterCost * valence;
  }
  if (state.connectorSystem === "welded-node") {
    if (state.material.nodePerStrutAdder === null) return null;
    return state.connectors.weldedNode.nodeShellCost + state.material.nodePerStrutAdder * valence;
  }
  if (state.material.nodeBaseCost === null || state.material.nodePerStrutAdder === null) return null;
  return state.material.nodeBaseCost + state.material.nodePerStrutAdder * valence;
};

const nodeFabricationNote = (valence: number, state: ProjectState): string => {
  if (state.connectorSystem === "ball-hub") return `${valence} sockets/adapters on configurable ball hub.`;
  if (state.connectorSystem === "welded-node") return `${valence} coped members welded to node shell or cluster.`;
  return `${valence} flattened drilled ends converge at bolted node or overlap joint.`;
};
