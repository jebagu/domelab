import type { SurfaceSettings, ValidationMessage } from "../types";
import { cross, dot, normalize, scale, sub, type Vec3 } from "./vector";

export interface SurfaceSample {
  position: Vec3;
  normal: Vec3;
  naturalZ: number;
  averageDiameterM: number;
}

export interface SurfaceModel {
  kind: SurfaceSettings["kind"];
  zMin: number;
  zMax: number;
  heightM: number;
  maxDiameterM: number;
  equatorZ: number;
  topOpeningDiameterM: number;
  warnings: ValidationMessage[];
  sampleAt: (z: number, phi: number) => SurfaceSample;
  sampleAtFraction: (v: number, u: number) => SurfaceSample;
  circumferenceAt: (z: number) => number;
}

interface SurfaceDefinition {
  kind: SurfaceSettings["kind"];
  naturalMinZ: number;
  naturalMaxZ: number;
  equatorNaturalZ: number;
  topOpeningDiameterM: number;
  maxDiameterM: number;
  pointAtNaturalZ: (z: number, phi: number) => Vec3;
  averageDiameterAtNaturalZ: (z: number) => number;
}

export const createSurfaceModel = (surface: SurfaceSettings): SurfaceModel => {
  const definition =
    surface.kind === "spherical"
      ? createSphericalDefinition(surface)
      : surface.kind === "ellipsoidal"
        ? createEllipsoidalDefinition(surface)
        : surface.kind === "onion"
          ? createOnionDefinition(surface)
          : surface.kind === "catenary"
            ? createCatenaryDefinition(surface)
            : createParaboloidDefinition(surface);
  const shift = (definition.naturalMinZ + definition.naturalMaxZ) / 2;
  const zMin = definition.naturalMinZ - shift;
  const zMax = definition.naturalMaxZ - shift;
  const heightM = zMax - zMin;

  const sampleAt = (z: number, phi: number): SurfaceSample => {
    const clampedZ = clamp(z, zMin, zMax);
    const naturalZ = clampedZ + shift;
    return {
      position: definition.pointAtNaturalZ(naturalZ, phi),
      normal: surfaceNormal(definition, naturalZ, phi),
      naturalZ,
      averageDiameterM: definition.averageDiameterAtNaturalZ(naturalZ)
    };
  };

  return {
    kind: surface.kind,
    zMin,
    zMax,
    heightM,
    maxDiameterM: definition.maxDiameterM,
    equatorZ: definition.equatorNaturalZ - shift,
    topOpeningDiameterM: definition.topOpeningDiameterM,
    warnings: [],
    sampleAt,
    sampleAtFraction: (v, u) => sampleAt(zMin + clamp(v, 0, 1) * heightM, clamp(u, 0, 1) * Math.PI * 2),
    circumferenceAt: (z) => Math.PI * Math.max(1e-6, definition.averageDiameterAtNaturalZ(clamp(z, zMin, zMax) + shift))
  };
};

const createSphericalDefinition = (surface: SurfaceSettings): SurfaceDefinition => {
  const radius = surface.spherical.radiusM;
  const topZ = topPlaneFromOpening(radius, surface.spherical.topOpeningDiameterM);
  const baseZ = clamp(surface.spherical.verticalCutPositionM, -radius, topZ - 0.01);

  return {
    kind: "spherical",
    naturalMinZ: baseZ,
    naturalMaxZ: topZ,
    equatorNaturalZ: 0,
    topOpeningDiameterM: surface.spherical.topOpeningDiameterM,
    maxDiameterM: surface.spherical.diameterM,
    pointAtNaturalZ: (z, phi) => {
      const clampedZ = clamp(z, -radius, radius);
      const ringRadius = Math.sqrt(Math.max(0, radius * radius - clampedZ * clampedZ));
      return [ringRadius * Math.cos(phi), ringRadius * Math.sin(phi), clampedZ - (baseZ + topZ) / 2];
    },
    averageDiameterAtNaturalZ: (z) => chordDiameter(radius, z)
  };
};

const createEllipsoidalDefinition = (surface: SurfaceSettings): SurfaceDefinition => {
  const a = surface.ellipsoidal.xDiameterM / 2;
  const b = surface.ellipsoidal.yDiameterM / 2;
  const c = surface.ellipsoidal.zHeightM / 2;
  const baseZ = c - surface.ellipsoidal.truncationHeightM;
  const topZ = resolveOpeningCut(
    baseZ,
    c,
    surface.ellipsoidal.topOpeningDiameterM,
    (z) => averageEllipticalDiameter(a, b, c, z)
  );

  return {
    kind: "ellipsoidal",
    naturalMinZ: baseZ,
    naturalMaxZ: topZ,
    equatorNaturalZ: 0,
    topOpeningDiameterM: surface.ellipsoidal.topOpeningDiameterM,
    maxDiameterM: Math.max(surface.ellipsoidal.xDiameterM, surface.ellipsoidal.yDiameterM),
    pointAtNaturalZ: (z, phi) => {
      const s = Math.sqrt(Math.max(0, 1 - (z * z) / (c * c)));
      return [a * s * Math.cos(phi), b * s * Math.sin(phi), z - (baseZ + topZ) / 2];
    },
    averageDiameterAtNaturalZ: (z) => averageEllipticalDiameter(a, b, c, z)
  };
};

const createOnionDefinition = (surface: SurfaceSettings): SurfaceDefinition => {
  const profile = onionProfile(surface, 0);
  const topZ = resolveOpeningCut(
    surface.onion.apexHeightM,
    surface.onion.overallHeightM,
    surface.onion.topOpeningDiameterM,
    (z) => profile(z) * 2
  );

  return {
    kind: "onion",
    naturalMinZ: 0,
    naturalMaxZ: topZ,
    equatorNaturalZ: surface.onion.shoulderHeightM,
    topOpeningDiameterM: surface.onion.topOpeningDiameterM,
    maxDiameterM: Math.max(surface.onion.baseDiameterM, surface.onion.maxBulgeDiameterM),
    pointAtNaturalZ: (z, phi) => {
      const ringRadius = profile(z);
      return [ringRadius * Math.cos(phi), ringRadius * Math.sin(phi), z - topZ / 2];
    },
    averageDiameterAtNaturalZ: (z) => profile(z) * 2
  };
};

const createCatenaryDefinition = (surface: SurfaceSettings): SurfaceDefinition => {
  const naturalMinZ = surface.catenary.heightM - surface.catenary.truncationHeightM;
  const topZ = resolveOpeningCut(
    naturalMinZ,
    surface.catenary.heightM,
    surface.catenary.topOpeningDiameterM,
    (z) => catenaryRadius(surface, z) * 2
  );

  return {
    kind: "catenary",
    naturalMinZ,
    naturalMaxZ: topZ,
    equatorNaturalZ: naturalMinZ,
    topOpeningDiameterM: surface.catenary.topOpeningDiameterM,
    maxDiameterM: surface.catenary.spanDiameterM,
    pointAtNaturalZ: (z, phi) => {
      const ringRadius = catenaryRadius(surface, z);
      return [ringRadius * Math.cos(phi), ringRadius * Math.sin(phi), z - (naturalMinZ + topZ) / 2];
    },
    averageDiameterAtNaturalZ: (z) => catenaryRadius(surface, z) * 2
  };
};

const createParaboloidDefinition = (surface: SurfaceSettings): SurfaceDefinition => {
  const naturalMinZ = surface.paraboloid.heightM - surface.paraboloid.truncationHeightM;
  const topZ = resolveOpeningCut(
    naturalMinZ,
    surface.paraboloid.heightM,
    surface.paraboloid.topOpeningDiameterM,
    (z) => paraboloidRadius(surface, z) * 2
  );

  return {
    kind: "paraboloid",
    naturalMinZ,
    naturalMaxZ: topZ,
    equatorNaturalZ: naturalMinZ,
    topOpeningDiameterM: surface.paraboloid.topOpeningDiameterM,
    maxDiameterM: surface.paraboloid.baseDiameterM,
    pointAtNaturalZ: (z, phi) => {
      const ringRadius = paraboloidRadius(surface, z);
      return [ringRadius * Math.cos(phi), ringRadius * Math.sin(phi), z - (naturalMinZ + topZ) / 2];
    },
    averageDiameterAtNaturalZ: (z) => paraboloidRadius(surface, z) * 2
  };
};

const onionProfile = (surface: SurfaceSettings, fallback = 0) => {
  const z0 = 0;
  const z1 = surface.onion.shoulderHeightM;
  const z2 = surface.onion.apexHeightM;
  const z3 = surface.onion.overallHeightM;
  const r0 = surface.onion.baseDiameterM / 2;
  const r1 = surface.onion.maxBulgeDiameterM / 2;
  const r2 = surface.onion.neckDiameterM / 2;
  const r3 = Math.max(surface.onion.topOpeningDiameterM / 2, fallback);

  return (z: number): number => {
    if (z <= z1) return cubicHermite(z, z0, z1, r0, r1, 0.35 * (r1 - r0), 0);
    if (z <= z2) return cubicHermite(z, z1, z2, r1, r2, 0, -0.35 * (r1 - r2));
    return cubicHermite(z, z2, z3, r2, r3, -0.25 * Math.max(0.05, r2 - r3), 0);
  };
};

const catenaryRadius = (surface: SurfaceSettings, z: number): number => {
  const t = clamp((surface.catenary.heightM - z) / surface.catenary.heightM, 0, 1);
  const factor = surface.catenary.shapeFactor;
  const scaled = Math.acosh(1 + t * (Math.cosh(factor) - 1)) / Math.max(1e-6, factor);
  return (surface.catenary.spanDiameterM / 2) * scaled;
};

const paraboloidRadius = (surface: SurfaceSettings, z: number): number => {
  const t = clamp(1 - z / surface.paraboloid.heightM, 0, 1);
  return (surface.paraboloid.baseDiameterM / 2) * Math.pow(t, 1 / Math.max(0.15, surface.paraboloid.curvatureCoefficient));
};

const surfaceNormal = (definition: SurfaceDefinition, naturalZ: number, phi: number): Vec3 => {
  const dz = Math.max(1e-4, (definition.naturalMaxZ - definition.naturalMinZ) * 1e-4);
  const dPhi = 1e-4;
  const center = definition.pointAtNaturalZ(naturalZ, phi);
  const up = definition.pointAtNaturalZ(clamp(naturalZ + dz, definition.naturalMinZ, definition.naturalMaxZ), phi);
  const around = definition.pointAtNaturalZ(naturalZ, phi + dPhi);
  let normal = normalize(cross(sub(around, center), sub(up, center)));
  if (dot(normal, center) < 0) {
    normal = scale(normal, -1);
  }
  return normal;
};

const averageEllipticalDiameter = (a: number, b: number, c: number, z: number): number => {
  const s = Math.sqrt(Math.max(0, 1 - (z * z) / (c * c)));
  return (a * s + b * s) * 2 * 0.5;
};

const topPlaneFromOpening = (radius: number, openingDiameterM: number): number => {
  const openingRadius = clamp(openingDiameterM / 2, 0, radius);
  return Math.sqrt(Math.max(0, radius * radius - openingRadius * openingRadius));
};

const chordDiameter = (radius: number, z: number): number =>
  Math.sqrt(Math.max(0, radius * radius - z * z)) * 2;

const resolveOpeningCut = (
  minZ: number,
  maxZ: number,
  openingDiameterM: number,
  diameterAt: (z: number) => number
): number => {
  if (!(openingDiameterM > 0)) return maxZ;
  let low = minZ;
  let high = maxZ;

  for (let iteration = 0; iteration < 48; iteration += 1) {
    const mid = (low + high) / 2;
    if (diameterAt(mid) > openingDiameterM) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high;
};

const cubicHermite = (z: number, z0: number, z1: number, r0: number, r1: number, m0: number, m1: number): number => {
  const t = clamp((z - z0) / Math.max(1e-6, z1 - z0), 0, 1);
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * r0 + h10 * (z1 - z0) * m0 + h01 * r1 + h11 * (z1 - z0) * m1;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
