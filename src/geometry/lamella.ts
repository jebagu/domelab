import type { EdgeRole, GeometrySettings, LamellaSettings, ValidationMessage } from "../types";
import { createGeometryResult } from "./common";
import { resolveCutRange } from "./clipping";
import type { Vec3 } from "./vector";

type LamellaEdge = { a: string; b: string; role: EdgeRole };

interface LamellaRing {
  ids: string[];
  phis: number[];
  isPole: boolean;
  offset: number;
}

export const generateLamella = (geometry: GeometrySettings, lamella: LamellaSettings) => {
  const radius = geometry.diameterM / 2;
  const warnings: ValidationMessage[] = [];

  if (lamella.triangulation === "none") {
    warnings.push({
      level: "warning",
      code: "lamella-not-triangulated",
      message:
        "Lamella diamond grid selected without triangulation. BOM is valid, but lateral stability depends on rings, joints, panels, or added bracing."
    });
  }

  const cut = resolveCutRange(geometry, radius);
  warnings.push(...cut.warnings);
  const thetaMin = Math.acos(Math.min(1, Math.max(-1, cut.maxZ / radius)));
  const thetaMax = Math.acos(Math.min(1, Math.max(-1, cut.minZ / radius)));
  const positions = new Map<string, Vec3>();
  const rings: LamellaRing[] = [];
  const rawEdges: LamellaEdge[] = [];
  let next = 0;

  for (let i = 0; i <= lamella.rings; i += 1) {
    const t = lamella.rings === 0 ? 0 : i / lamella.rings;
    const theta = thetaMin + (thetaMax - thetaMin) * t;
    const ringRadius = radius * Math.sin(theta);
    const z = radius * Math.cos(theta);
    const isPole = ringRadius < radius * 0.0001;
    const count = isPole ? 1 : lamella.sectors;
    const offset = ringOffset(lamella, i, count);
    const ids: string[] = [];
    const phis: number[] = [];

    for (let j = 0; j < count; j += 1) {
      const phi = normalizeAngle(count === 1 ? 0 : (Math.PI * 2 * j) / count + offset);
      const id = `l${next++}`;
      positions.set(id, [ringRadius * Math.cos(phi), ringRadius * Math.sin(phi), z]);
      ids.push(id);
      phis.push(phi);
    }
    rings.push({ ids, phis, isPole, offset });
  }

  rings.forEach((ring, i) => {
    if (ring.ids.length <= 2) return;
    const isCrown = i === 0;
    const isBase = i === rings.length - 1;
    if ((isCrown && !lamella.crownRing) || (isBase && !lamella.baseRing) || (!isCrown && !isBase && !lamella.hoopRings)) {
      return;
    }
    const role: EdgeRole = isCrown ? "crown-ring" : isBase ? "base-ring" : "hoop";
    for (let j = 0; j < ring.ids.length; j += 1) {
      rawEdges.push({ a: ring.ids[j], b: ring.ids[(j + 1) % ring.ids.length], role });
    }
  });

  for (let i = 0; i < rings.length - 1; i += 1) {
    connectLamellaBand(rings[i], rings[i + 1], rawEdges, preferredHand(lamella, i));
  }

  return createGeometryResult(positions, rawEdges, [], radius, warnings, cut.baseZ);
};

const connectLamellaBand = (
  inner: LamellaRing,
  outer: LamellaRing,
  edges: LamellaEdge[],
  hand: -1 | 1
) => {
  if (inner.ids.length === 1) {
    outer.ids.forEach((target) => edges.push({ a: inner.ids[0], b: target, role: "diagonal" }));
    return;
  }

  if (outer.ids.length === 1) {
    inner.ids.forEach((source) => edges.push({ a: source, b: outer.ids[0], role: "diagonal" }));
    return;
  }

  inner.ids.forEach((source, index) => {
    const targets = nearestTwoIndices(inner.phis[index], outer.phis, hand);
    targets.forEach((target) => edges.push({ a: source, b: outer.ids[target], role: "diagonal" }));
  });
};

const nearestTwoIndices = (phi: number, targetPhis: number[], hand: -1 | 1): number[] => {
  const ranked = targetPhis
    .map((targetPhi, index) => ({
      index,
      distance: circularDistance(phi, targetPhi),
      signed: signedCircularDistance(phi, targetPhi)
    }))
    .sort((a, b) => {
      const distanceDelta = a.distance - b.distance;
      if (Math.abs(distanceDelta) > 1e-9) return distanceDelta;
      return hand * (a.signed - b.signed);
    });

  return [...new Set(ranked.slice(0, 2).map((item) => item.index))];
};

const ringOffset = (settings: LamellaSettings, ringIndex: number, count: number): number => {
  if (count <= 1) return 0;
  const sectorAngle = (Math.PI * 2) / count;
  if (settings.style === "curved") return (ringIndex * sectorAngle) / 3;
  if (settings.style === "alternating") return ringIndex % 2 === 0 ? 0 : sectorAngle / 2;
  return 0;
};

const preferredHand = (settings: LamellaSettings, ringIndex: number): -1 | 1 => {
  if (settings.handedness === "left") return -1;
  if (settings.handedness === "right") return 1;
  return ringIndex % 2 === 0 ? 1 : -1;
};

const normalizeAngle = (angle: number): number => {
  const tau = Math.PI * 2;
  return ((angle % tau) + tau) % tau;
};

const signedCircularDistance = (from: number, to: number): number => {
  const tau = Math.PI * 2;
  return ((((to - from) % tau) + Math.PI * 3) % tau) - Math.PI;
};

const circularDistance = (a: number, b: number): number => Math.abs(signedCircularDistance(a, b));
