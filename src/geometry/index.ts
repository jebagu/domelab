import type { GeometryResult, ProjectState, ValidationMessage } from "../types";
import { generateGeodesic } from "./geodesic";
import { generateLamella } from "./lamella";
import { generateRibbedRectangular } from "./ribbedRectangular";
import { measureSync } from "../utils/debug";
import { generatePatternGeometry } from "./patterns";
import { createGeometryResult } from "./common";
import { applyNodeTreatment } from "./nodeTreatment";
import { cross, normalize, type Vec3 } from "./vector";

export const generateGeometry = (state: ProjectState): GeometryResult => {
  const validation = validateGeometrySettings(state);
  const errors = validation.filter((message) => message.level === "error");

  if (errors.length > 0) {
    return { nodes: [], edges: [], faces: [], warnings: validation };
  }

  const result = measureSync(
    "geometry",
    `generate-${state.pattern.kind}`,
    () => {
      if (state.surface.kind === "spherical" && state.pattern.kind === "geodesic") {
        return annotateSphericalFrames(generateGeodesic(state.geometry, state.geodesic));
      }
      if (state.surface.kind === "spherical" && state.pattern.kind === "lamella") {
        return annotateSphericalFrames(generateLamella(state.geometry, state.lamella));
      }
      if (state.surface.kind === "spherical" && state.pattern.kind === "schwedler-ribbed") {
        return annotateSphericalFrames(generateRibbedRectangular(state.geometry, state.ribbedRectangular));
      }

      const raw = generatePatternGeometry(state);
      return createGeometryResult(raw.positions, raw.edges, raw.faces, state.geometry.diameterM / 2, raw.warnings, raw.baseZ, {
        nodeFrames: raw.nodeFrames,
        topZ: raw.topZ
      });
    },
    {
      surface: state.surface.kind,
      pattern: state.pattern.kind,
      diameterM: Number(state.geometry.diameterM.toFixed(3))
    }
  );

  const treated = applyNodeTreatment(result, state.nodes);
  return { ...treated, warnings: [...validation, ...result.warnings] };
};

const validateGeometrySettings = (state: ProjectState): ValidationMessage[] => {
  const messages: ValidationMessage[] = [];
  const diameter = state.geometry.diameterM;
  if (!(diameter > 0)) {
    messages.push({ level: "error", code: "diameter-positive", message: "Diameter must be greater than zero." });
  }
  if (diameter > 50) {
    messages.push({
      level: "warning",
      code: "diameter-design-envelope",
      message: "Viewport and default fabrication assumptions are tuned for spheres up to 50 m diameter."
    });
  }
  if (state.pattern.geodesic.frequency < 1 || state.pattern.geodesic.frequency > 8) {
    messages.push({
      level: "error",
      code: "frequency-range",
      message: "Geodesic frequency must be 1V through 8V."
    });
  }
  if (state.pattern.kind === "reciprocal-frame" && state.nodes.kind === "rings") {
    messages.push({
      level: "info",
      code: "reciprocal-rings-preview",
      message: "Reciprocal frame + ring nodes is allowed as a preview. Check overlap and connection clearance in detail."
    });
  }
  if (state.surface.kind === "spherical" && state.surface.spherical.domeHeightM > state.surface.spherical.diameterM) {
    messages.push({
      level: "error",
      code: "sphere-height-range",
      message: "Spherical dome height must be between 0 and the diameter."
    });
  }
  if (state.pattern.lamella.sectors < 3 || state.pattern.schwedlerRibbed.meridionalRibs < 3) {
    messages.push({
      level: "error",
      code: "sector-rib-minimum",
      message: "Sector and rib counts must be at least 3."
    });
  }
  if (state.pattern.lamella.horizontalRings < 1 || state.pattern.schwedlerRibbed.horizontalRings < 1) {
    messages.push({ level: "error", code: "ring-minimum", message: "Ring count must be at least 1." });
  }
  if (state.nodes.kind === "rings" && state.nodes.rings.maxAttachments !== null) {
    const allowed = state.nodes.rings.maxAttachments;
    const likelyValence =
      state.pattern.kind === "geodesic"
        ? 6
        : state.pattern.kind === "hexagons-pentagons"
          ? 3
          : state.pattern.kind === "reciprocal-frame"
            ? 4
            : 4;
    if (allowed < likelyValence) {
      messages.push({
        level: "warning",
        code: "ring-attachment-limit-low",
        message: `Configured ring attachment limit (${allowed}) may be lower than the expected node valence for this pattern.`
      });
    }
  }
  return messages;
};

const annotateSphericalFrames = (geometry: GeometryResult): GeometryResult => ({
  ...geometry,
  nodes: geometry.nodes.map((node) => {
    const normal = normalize(node.position);
    const tangentX = normalize(Math.abs(normal[2]) > 0.85 ? ([1, 0, 0] as Vec3) : ([-normal[1], normal[0], 0] as Vec3));
    const tangentY = normalize(cross(normal, tangentX));
    return {
      ...node,
      surfaceNormal: normal,
      tangentX,
      tangentY
    };
  })
});
