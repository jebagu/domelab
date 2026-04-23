import type { GeometryResult, NodeSettings } from "../types";
import { add, distance, dot, normalize, scale, sub, type Vec3 } from "./vector";

export const applyNodeTreatment = (geometry: GeometryResult, nodes: NodeSettings): GeometryResult => {
  if (nodes.kind === "points") {
    return {
      ...geometry,
      nodes: geometry.nodes.map((node) => ({ ...node, ring: undefined }))
    };
  }

  const ringRadiusM = nodes.rings.ringDiameterMm / 2000;
  const tubeDiameterM = nodes.rings.ringTubeDiameterMm / 1000;
  const eccentricOffsetM = nodes.rings.eccentricOffsetMm / 1000;
  const stubLengthM = nodes.rings.weldStubLengthMm / 1000;
  const rotationRad = (nodes.rings.rotationAboutNormalDeg * Math.PI) / 180;
  const updatedNodes = geometry.nodes.map((node) => {
    const normal = nodes.rings.orientationMode === "horizontal" ? ([0, 0, 1] as Vec3) : normalize(node.surfaceNormal ?? [0, 0, 1]);
    const baseTangentX = normalize(node.tangentX ?? fallbackTangent(normal));
    const baseTangentY = normalize(node.tangentY ?? crossTangent(normal, baseTangentX));
    const tangentX = rotateBasis(baseTangentX, baseTangentY, rotationRad);
    const tangentY = normalize(crossTangent(normal, tangentX));
    const center = add(node.position, scale(normal, eccentricOffsetM));
    return {
      ...node,
      ring: {
        center,
        diameterM: ringRadiusM * 2,
        tubeDiameterM,
        normal,
        tangentX,
        tangentY
      }
    };
  });

  const nodeMap = new Map(updatedNodes.map((node) => [node.id, node]));
  const updatedEdges = geometry.edges.map((edge) => {
    const a = nodeMap.get(edge.nodeA)!;
    const b = nodeMap.get(edge.nodeB)!;
    const start = ringAttachmentPoint(a, b.position, ringRadiusM, stubLengthM);
    const end = ringAttachmentPoint(b, a.position, ringRadiusM, stubLengthM);
    const modelLengthM = distance(start, end);
    return {
      ...edge,
      renderStart: start,
      renderEnd: end,
      modelLengthM,
      fabricationLengthM: modelLengthM,
      cutLengthM: modelLengthM
    };
  });

  return { ...geometry, nodes: updatedNodes, edges: updatedEdges };
};

const ringAttachmentPoint = (
  node: GeometryResult["nodes"][number],
  otherPosition: Vec3,
  ringRadiusM: number,
  stubLengthM: number
): Vec3 => {
  if (!node.ring) return node.position;
  const direction = normalize(sub(otherPosition, node.ring.center));
  const tangentDirection = sub(direction, scale(node.ring.normal, dot(direction, node.ring.normal)));
  const perimeterDirection = normalize(
    isTiny(tangentDirection) ? add(node.ring.tangentX, scale(node.ring.tangentY, 0.0001)) : tangentDirection
  );
  const perimeter = add(node.ring.center, scale(perimeterDirection, ringRadiusM));
  return stubLengthM > 0 ? add(perimeter, scale(normalize(sub(otherPosition, perimeter)), stubLengthM)) : perimeter;
};

const rotateBasis = (tangentX: Vec3, tangentY: Vec3, rotationRad: number): Vec3 =>
  normalize(add(scale(tangentX, Math.cos(rotationRad)), scale(tangentY, Math.sin(rotationRad))));

const fallbackTangent = (normal: Vec3): Vec3 =>
  Math.abs(normal[2]) > 0.85 ? normalize([1, 0, 0]) : normalize([-normal[1], normal[0], 0]);

const crossTangent = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];

const isTiny = (vector: Vec3): boolean => Math.abs(vector[0]) + Math.abs(vector[1]) + Math.abs(vector[2]) < 1e-8;
