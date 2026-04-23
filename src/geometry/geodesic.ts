import type { Face, GeometrySettings, GeodesicSettings, ValidationMessage } from "../types";
import { createGeometryResult } from "./common";
import { resolveCutRange, snapPlaneZToNearestAvailable } from "./clipping";
import { add, normalize, quantizedKey, rotateEuler, scale, sortedPairKey, type Vec3 } from "./vector";

interface Icosahedron {
  vertices: Vec3[];
  faces: Array<[number, number, number]>;
}

interface GeodesicBaseMesh {
  radius: number;
  positions: Map<string, Vec3>;
  rawFaces: Array<[string, string, string]>;
}

export const geodesicExpectedCounts = (frequency: number) => ({
  vertices: 10 * frequency * frequency + 2,
  edges: 30 * frequency * frequency,
  faces: 20 * frequency * frequency
});

export const generateGeodesic = (geometry: GeometrySettings, geodesic: GeodesicSettings) => {
  const warnings: ValidationMessage[] = [];
  const { radius, positions, rawFaces } = createGeodesicBaseMesh(geometry, geodesic);

  if (geometry.shape === "full-sphere") {
    const result = createGeometryResult(positions, extractEdges(rawFaces), rawFaces, radius, warnings);
    return result;
  }

  const availableZValues = listUniqueZValues(positions, radius);
  const cut = resolveCutRange(geometry, radius, availableZValues);
  warnings.push(...cut.warnings);

  return createClippedMeshResult(positions, rawFaces, cut.minZ, cut.maxZ, radius, warnings, cut.baseZ);
};

export const listGeodesicNodeLayerZValues = (geometry: GeometrySettings, geodesic: GeodesicSettings): number[] =>
  listUniqueZValues(createGeodesicBaseMesh(geometry, geodesic).positions, geometry.diameterM / 2);

export const snapGeodesicCoverageToNodeLayer = (
  geometry: GeometrySettings,
  geodesic: GeodesicSettings,
  requestedCoverage: number
): number => {
  const coverage = Math.min(1, Math.max(0.5, requestedCoverage));
  const radius = geometry.diameterM / 2;
  const desiredBaseZ = radius - geometry.diameterM * coverage;
  const snappedBaseZ = snapPlaneZToNearestAvailable(
    desiredBaseZ,
    listGeodesicNodeLayerZValues(geometry, geodesic),
    Math.max(radius * 1e-6, 1e-7)
  );

  return Math.min(1, Math.max(0.5, (radius - snappedBaseZ) / geometry.diameterM));
};

const extractEdges = (faces: Array<[string, string, string]>) => {
  const edgeMap = new Map<string, { a: string; b: string }>();
  faces.forEach(([a, b, c]) => {
    [
      [a, b],
      [b, c],
      [c, a]
    ].forEach(([x, y]) => {
      const key = sortedPairKey(x, y);
      if (!edgeMap.has(key)) edgeMap.set(key, { a: x, b: y });
    });
  });
  return [...edgeMap.values()];
};

const createClippedMeshResult = (
  positions: Map<string, Vec3>,
  rawFaces: Array<[string, string, string]>,
  minZ: number,
  maxZ: number,
  radius: number,
  warnings: ValidationMessage[],
  baseZ?: number
) => {
  const eps = Math.max(radius * 1e-6, 1e-7);
  const clippedPositions = new Map<string, Vec3>();
  const pointIds = new Map<string, string>();
  const clippedEdges: Array<{ a: string; b: string }> = [];
  const clippedFaces: Array<[string, string, string]> = [];
  let cutNodeIndex = 0;

  const registerPoint = (point: Vec3, preferredId?: string) => {
    const key = quantizedKey(point);
    const existing = pointIds.get(key);
    if (existing) return existing;
    const id = preferredId && !clippedPositions.has(preferredId) ? preferredId : preferredId ?? `cut${cutNodeIndex++}`;
    pointIds.set(key, id);
    clippedPositions.set(id, point);
    return id;
  };

  positions.forEach((position, id) => {
    registerPoint(position, id);
  });

  const clipPolygonToPlane = (
    polygon: Array<{ id: string; position: Vec3 }>,
    planeZ: number,
    keepAbove: boolean
  ): Array<{ id: string; position: Vec3 }> => {
    if (polygon.length === 0) return polygon;
    const result: Array<{ id: string; position: Vec3 }> = [];

    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      const currentInside = keepAbove ? current.position[2] >= planeZ - eps : current.position[2] <= planeZ + eps;
      const nextInside = keepAbove ? next.position[2] >= planeZ - eps : next.position[2] <= planeZ + eps;

      if (currentInside) {
        result.push(current);
      }

      if (currentInside !== nextInside) {
        const t = (planeZ - current.position[2]) / (next.position[2] - current.position[2]);
        const point: Vec3 = [
          current.position[0] + (next.position[0] - current.position[0]) * t,
          current.position[1] + (next.position[1] - current.position[1]) * t,
          planeZ
        ];
        result.push({ id: registerPoint(point), position: point });
      }
    }

    return normalizePolygon(result);
  };

  rawFaces.forEach((face) => {
    let polygon = face.map((id) => ({ id, position: positions.get(id)! }));
    polygon = clipPolygonToPlane(polygon, minZ, true);
    polygon = clipPolygonToPlane(polygon, maxZ, false);

    if (polygon.length < 2) return;

    for (let index = 0; index < polygon.length; index += 1) {
      clippedEdges.push({
        a: polygon[index].id,
        b: polygon[(index + 1) % polygon.length].id
      });
    }

    if (polygon.length >= 3) {
      for (let index = 1; index < polygon.length - 1; index += 1) {
        clippedFaces.push([polygon[0].id, polygon[index].id, polygon[index + 1].id]);
      }
    }
  });

  return createGeometryResult(clippedPositions, clippedEdges, clippedFaces, radius, warnings, baseZ);
};

const normalizePolygon = (polygon: Array<{ id: string; position: Vec3 }>): Array<{ id: string; position: Vec3 }> => {
  const deduped = polygon.filter((vertex, index) => index === 0 || vertex.id !== polygon[index - 1].id);
  if (deduped.length > 1 && deduped[0].id === deduped[deduped.length - 1].id) deduped.pop();
  return deduped.length >= 2 ? deduped : [];
};

const createGeodesicBaseMesh = (geometry: GeometrySettings, geodesic: GeodesicSettings): GeodesicBaseMesh => {
  const f = geodesic.frequency;
  const radius = geometry.diameterM / 2;
  const ico = createIcosahedron();
  const vertexMap = new Map<string, string>();
  const positions = new Map<string, Vec3>();
  const rawFaces: Array<[string, string, string]> = [];
  let nextVertex = 0;

  const rotation = resolveOrientationRotation(geometry.orientation.mode, geometry.orientation.rotationEuler);

  const dedupe = (point: Vec3): string => {
    const projected = rotateEuler(scale(normalize(point), radius), rotation);
    const key = quantizedKey(projected);
    const existing = vertexMap.get(key);
    if (existing) return existing;
    const id = `v${nextVertex++}`;
    vertexMap.set(key, id);
    positions.set(id, projected);
    return id;
  };

  ico.faces.forEach(([ia, ib, ic]) => {
    const a = ico.vertices[ia];
    const b = ico.vertices[ib];
    const c = ico.vertices[ic];
    const grid = new Map<string, string>();

    for (let i = 0; i <= f; i += 1) {
      for (let j = 0; j <= f - i; j += 1) {
        const k = f - i - j;
        const p = scale(add(add(scale(a, k), scale(b, i)), scale(c, j)), 1 / f);
        grid.set(`${i},${j}`, dedupe(p));
      }
    }

    for (let i = 0; i < f; i += 1) {
      for (let j = 0; j < f - i; j += 1) {
        rawFaces.push([grid.get(`${i},${j}`)!, grid.get(`${i + 1},${j}`)!, grid.get(`${i},${j + 1}`)!]);

        if (j < f - i - 1) {
          rawFaces.push([
            grid.get(`${i + 1},${j}`)!,
            grid.get(`${i + 1},${j + 1}`)!,
            grid.get(`${i},${j + 1}`)!
          ]);
        }
      }
    }
  });

  return { radius, positions, rawFaces };
};

const createIcosahedron = (): Icosahedron => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const rawVertices: Vec3[] = [
    [-1, phi, 0],
    [1, phi, 0],
    [-1, -phi, 0],
    [1, -phi, 0],
    [0, -1, phi],
    [0, 1, phi],
    [0, -1, -phi],
    [0, 1, -phi],
    [phi, 0, -1],
    [phi, 0, 1],
    [-phi, 0, -1],
    [-phi, 0, 1]
  ];
  const vertices = rawVertices.map(normalize);

  const faces: Array<[number, number, number]> = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1]
  ];

  return { vertices, faces };
};

const resolveOrientationRotation = (
  mode: GeometrySettings["orientation"]["mode"],
  custom: [number, number, number]
): [number, number, number] => {
  if (mode === "face-up") return [0.553574, 0, 0];
  if (mode === "edge-up") return [0, 0, Math.PI / 10];
  if (mode === "custom") return custom;
  return [0, 0, 0];
};

export const edgeCountFromFaces = (faces: Face[]): number => {
  const keys = new Set<string>();
  faces.forEach((face) => {
    const [a, b, c] = face.nodeIds;
    keys.add(sortedPairKey(a, b));
    keys.add(sortedPairKey(b, c));
    keys.add(sortedPairKey(c, a));
  });
  return keys.size;
};

const listUniqueZValues = (positions: Map<string, Vec3>, radius: number): number[] => {
  const tolerance = Math.max(radius * 1e-7, 1e-8);
  return [...positions.values()]
    .map((position) => position[2])
    .sort((a, b) => a - b)
    .filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > tolerance);
};
