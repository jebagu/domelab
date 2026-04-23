import type { Edge, EdgeRole, Face, GeometryResult, Node, NodeRole, ValidationMessage } from "../types";
import { distance, sortedPairKey, type Vec3 } from "./vector";

interface RawEdge {
  a: string;
  b: string;
  role?: EdgeRole;
  renderStart?: Vec3;
  renderEnd?: Vec3;
}

interface GeometryMetadata {
  nodeFrames?: Map<string, { normal: Vec3; tangentX: Vec3; tangentY: Vec3 }>;
  topZ?: number;
}

export const createGeometryResult = (
  positions: Map<string, [number, number, number]>,
  rawEdges: RawEdge[],
  rawFaces: Array<[string, string, string]>,
  radius: number,
  connectorWarnings: ValidationMessage[] = [],
  baseZ?: number,
  metadata: GeometryMetadata = {}
): GeometryResult => {
  const usedNodeIds = new Set<string>();
  const edgeMap = new Map<string, RawEdge>();

  rawEdges.forEach((edge) => {
    if (edge.a === edge.b) return;
    if (!positions.has(edge.a) || !positions.has(edge.b)) return;
    const key = sortedPairKey(edge.a, edge.b);
    if (!edgeMap.has(key)) {
      edgeMap.set(key, edge);
      usedNodeIds.add(edge.a);
      usedNodeIds.add(edge.b);
    }
  });

  rawFaces.forEach((face) => face.forEach((id) => usedNodeIds.add(id)));

  const orderedIds = [...usedNodeIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const idMap = new Map<string, string>();
  const nodes: Node[] = orderedIds.map((oldId, index) => {
    const id = `n${index}`;
    idMap.set(oldId, id);
    const frame = metadata.nodeFrames?.get(oldId);
    return {
      id,
      position: positions.get(oldId)!,
      role: classifyNodeRole(positions.get(oldId)!, radius, baseZ, metadata.topZ),
      incidentEdgeIds: [],
      valence: 0,
      surfaceNormal: frame?.normal,
      tangentX: frame?.tangentX,
      tangentY: frame?.tangentY
    };
  });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges: Edge[] = [...edgeMap.values()].map((raw, index) => {
    const nodeA = idMap.get(raw.a)!;
    const nodeB = idMap.get(raw.b)!;
    const a = nodeById.get(nodeA)!;
    const b = nodeById.get(nodeB)!;
    const id = `e${index}`;
    a.incidentEdgeIds.push(id);
    b.incidentEdgeIds.push(id);
    return {
      id,
      nodeA,
      nodeB,
      role: raw.role ?? inferEdgeRole(a.role, b.role),
      modelLengthM: distance(raw.renderStart ?? a.position, raw.renderEnd ?? b.position),
      fabricationLengthM: distance(raw.renderStart ?? a.position, raw.renderEnd ?? b.position),
      cutLengthM: distance(raw.renderStart ?? a.position, raw.renderEnd ?? b.position),
      renderStart: raw.renderStart,
      renderEnd: raw.renderEnd,
      materialProfileId: "default-profile",
      connectorSystem: "flattened-drilled-bolted",
      endConditionA: { type: "plain-cut" },
      endConditionB: { type: "plain-cut" }
    };
  });

  nodes.forEach((node) => {
    node.valence = node.incidentEdgeIds.length;
  });

  const faces: Face[] = rawFaces
    .filter(([a, b, c]) => idMap.has(a) && idMap.has(b) && idMap.has(c))
    .map((face, index) => ({
      id: `f${index}`,
      nodeIds: [idMap.get(face[0])!, idMap.get(face[1])!, idMap.get(face[2])!]
    }));

  return {
    nodes,
    edges,
    faces,
    warnings: connectorWarnings
  };
};

const classifyNodeRole = (position: [number, number, number], radius: number, baseZ?: number, topZ = radius): NodeRole => {
  const eps = Math.max(radius * 0.001, 1e-5);
  if (Math.abs(position[2] - topZ) < eps) return Math.abs(topZ - radius) < eps ? "crown" : "cut";
  if (baseZ !== undefined && Math.abs(position[2] - baseZ) < eps) return "base";
  if (baseZ !== undefined && Math.abs(position[2] - baseZ) < eps * 4) return "boundary";
  return "interior";
};

const inferEdgeRole = (a: NodeRole, b: NodeRole): EdgeRole => {
  if (a === "base" && b === "base") return "base-ring";
  if (a === "crown" && b === "crown") return "crown-ring";
  if (a === "boundary" || b === "boundary" || a === "base" || b === "base") return "boundary";
  return "interior";
};
