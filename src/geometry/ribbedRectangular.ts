import type { GeometrySettings, RibbedRectangularSettings, ValidationMessage } from "../types";
import { createGeometryResult } from "./common";
import { resolveCutRange } from "./clipping";
import type { Vec3 } from "./vector";

export const generateRibbedRectangular = (
  geometry: GeometrySettings,
  ribbed: RibbedRectangularSettings
) => {
  const radius = geometry.diameterM / 2;
  const warnings: ValidationMessage[] = [];
  if (ribbed.diagonalBracing === "none") {
    warnings.push({
      level: "warning",
      code: "ribbed-no-diagonals",
      message:
        "Rectangular grid selected without diagonal bracing. BOM is valid, but this is not a triangulated frame. Structural behavior depends on rigid joints, panels, rings, or additional bracing."
    });
  }

  const cut = resolveCutRange(geometry, radius);
  warnings.push(...cut.warnings);
  const thetaMin = Math.acos(Math.min(1, Math.max(-1, cut.maxZ / radius)));
  const thetaMax = Math.acos(Math.min(1, Math.max(-1, cut.minZ / radius)));
  const positions = new Map<string, Vec3>();
  const ringIds: string[][] = [];
  const rawEdges: Array<{ a: string; b: string; role: "rib" | "hoop" | "diagonal" | "base-ring" | "crown-ring" }> =
    [];
  let next = 0;

  for (let i = 0; i <= ribbed.rings; i += 1) {
    const theta = thetaMin + ((thetaMax - thetaMin) * i) / ribbed.rings;
    const ringRadius = radius * Math.sin(theta);
    const z = radius * Math.cos(theta);
    const isPole = ringRadius < radius * 0.0001;
    const count = isPole ? 1 : ribbed.ribs;
    const ids: string[] = [];

    for (let j = 0; j < count; j += 1) {
      const phi = count === 1 ? 0 : (Math.PI * 2 * j) / count;
      const id = `r${next++}`;
      positions.set(id, [ringRadius * Math.cos(phi), ringRadius * Math.sin(phi), z]);
      ids.push(id);
    }
    ringIds.push(ids);
  }

  ringIds.forEach((ring, i) => {
    if (ring.length <= 2) return;
    const role = i === 0 ? "crown-ring" : i === ringIds.length - 1 ? "base-ring" : "hoop";
    for (let j = 0; j < ring.length; j += 1) {
      rawEdges.push({ a: ring[j], b: ring[(j + 1) % ring.length], role });
    }
  });

  for (let i = 0; i < ringIds.length - 1; i += 1) {
    connectSameMeridian(ringIds[i], ringIds[i + 1], rawEdges);
    addDiagonals(ringIds[i], ringIds[i + 1], rawEdges, ribbed.diagonalBracing, i);
  }

  return createGeometryResult(positions, rawEdges, [], radius, warnings, cut.baseZ);
};

const connectSameMeridian = (
  a: string[],
  b: string[],
  edges: Array<{ a: string; b: string; role: "rib" | "hoop" | "diagonal" | "base-ring" | "crown-ring" }>
) => {
  if (a.length === 1) {
    b.forEach((target) => edges.push({ a: a[0], b: target, role: "rib" }));
    return;
  }
  if (b.length === 1) {
    a.forEach((source) => edges.push({ a: source, b: b[0], role: "rib" }));
    return;
  }
  for (let j = 0; j < Math.min(a.length, b.length); j += 1) {
    edges.push({ a: a[j], b: b[j], role: "rib" });
  }
};

const addDiagonals = (
  a: string[],
  b: string[],
  edges: Array<{ a: string; b: string; role: "rib" | "hoop" | "diagonal" | "base-ring" | "crown-ring" }>,
  bracing: RibbedRectangularSettings["diagonalBracing"],
  ringIndex: number
) => {
  if (bracing === "none" || a.length === 1 || b.length === 1) return;
  const count = Math.min(a.length, b.length);
  for (let j = 0; j < count; j += 1) {
    const forward = (j + 1) % b.length;
    const backward = (j - 1 + b.length) % b.length;
    const useForward = bracing === "single" || (bracing === "alternating" && (j + ringIndex) % 2 === 0);
    edges.push({ a: a[j], b: b[useForward ? forward : backward], role: "diagonal" });
    if (bracing === "x-brace") {
      edges.push({ a: a[j], b: b[backward], role: "diagonal" });
    }
  }
};
