import type { GeometrySettings, ValidationMessage } from "../types";

export const snapPlaneZToNearestAvailable = (
  desiredZ: number,
  availableZValues?: number[],
  tolerance = 1e-7
): number => {
  if (!availableZValues || availableZValues.length === 0) return desiredZ;
  const unique = [...availableZValues]
    .sort((a, b) => a - b)
    .filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > tolerance);

  return unique.reduce((closest, candidate) =>
    Math.abs(candidate - desiredZ) < Math.abs(closest - desiredZ) ? candidate : closest
  );
};

export const resolveCutRange = (
  geometry: GeometrySettings,
  radius: number,
  availableZValues?: number[]
): { minZ: number; maxZ: number; baseZ?: number; warnings: ValidationMessage[] } => {
  const warnings: ValidationMessage[] = [];
  const snapTolerance = Math.max(radius * 1e-6, 1e-7);
  const maybeSnapBaseZ = (desiredZ: number): number => {
    if (!geometry.snapCoverageToNodeLayer) return desiredZ;
    const snappedZ = snapPlaneZToNearestAvailable(desiredZ, availableZValues, snapTolerance);
    if (Math.abs(snappedZ - desiredZ) > snapTolerance) {
      warnings.push({
        level: "info",
        code: "coverage-snapped-to-node-layer",
        message: `Coverage snapped from z=${desiredZ.toFixed(3)} m to the nearest node layer at z=${snappedZ.toFixed(3)} m to collapse near-overlapping boundary nodes.`
      });
    }
    return snappedZ;
  };

  if (geometry.shape === "full-sphere") {
    return { minZ: -radius, maxZ: radius, warnings };
  }

  if (geometry.shape === "hemisphere") {
    return { minZ: 0, maxZ: radius, baseZ: 0, warnings };
  }

  if (geometry.shape === "spherical-cap") {
    const h = geometry.capHeightM ?? radius;
    const zBase = maybeSnapBaseZ(radius - h);
    warnings.push({
      level: "warning",
      code: "cap-plane-cut",
      message: "Spherical cap uses a geometric cut plane. Boundary members may become custom fabrication groups."
    });
    return { minZ: zBase, maxZ: radius, baseZ: zBase, warnings };
  }

  if (geometry.shape === "flattened-base") {
    const desired = geometry.cutPlaneZ ?? 0;
    const snapped = maybeSnapBaseZ(desired);
    warnings.push({
      level: "info",
      code: "flat-base-plane-cut",
      message: `Flattened base uses a geometric cut plane at z=${snapped.toFixed(3)} m and synthesizes a bottom boundary ring.`
    });
    return { minZ: snapped, maxZ: radius, baseZ: snapped, warnings };
  }

  const bottom = geometry.bottomCutPlaneZ ?? -radius * 0.25;
  const top = geometry.topCutPlaneZ ?? radius * 0.75;
  warnings.push({
    level: "warning",
    code: "sphere-segment-cuts",
    message: "Sphere segment uses two cut planes and can create custom top and bottom boundary groups."
  });
  return { minZ: Math.min(bottom, top), maxZ: Math.max(bottom, top), baseZ: Math.min(bottom, top), warnings };
};

export const withinCutRange = (z: number, minZ: number, maxZ: number, tolerance = 1e-7): boolean =>
  z >= minZ - tolerance && z <= maxZ + tolerance;
