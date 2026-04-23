import type { GeometryResult, ProjectState, ValidationMessage } from "../types";
import { generateGeodesic } from "./geodesic";
import { generateLamella } from "./lamella";
import { generateRibbedRectangular } from "./ribbedRectangular";
import { measureSync } from "../utils/debug";

export const generateGeometry = (state: ProjectState): GeometryResult => {
  const validation = validateGeometrySettings(state);
  const errors = validation.filter((message) => message.level === "error");

  if (errors.length > 0) {
    return { nodes: [], edges: [], faces: [], warnings: validation };
  }

  const result = measureSync(
    "geometry",
    `generate-${state.geometry.pattern}`,
    () =>
      state.geometry.pattern === "geodesic"
        ? generateGeodesic(state.geometry, state.geodesic)
        : state.geometry.pattern === "lamella"
          ? generateLamella(state.geometry, state.lamella)
          : generateRibbedRectangular(state.geometry, state.ribbedRectangular),
    {
      shape: state.geometry.shape,
      diameterM: Number(state.geometry.diameterM.toFixed(3))
    }
  );

  return { ...result, warnings: [...validation, ...result.warnings] };
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
  if (state.geodesic.frequency < 1 || state.geodesic.frequency > 8) {
    messages.push({
      level: "error",
      code: "frequency-range",
      message: "Geodesic frequency must be 1V through 8V."
    });
  }
  if (
    state.geometry.sphereCoverage !== undefined &&
    (state.geometry.sphereCoverage < 0.5 || state.geometry.sphereCoverage > 1)
  ) {
    messages.push({
      level: "error",
      code: "sphere-coverage-range",
      message: "Sphere coverage must be between 50% and 100%."
    });
  }
  if (
    state.geometry.shape === "spherical-cap" &&
    (state.geometry.capHeightM === undefined ||
      state.geometry.capHeightM <= 0 ||
      state.geometry.capHeightM > state.geometry.diameterM)
  ) {
    messages.push({
      level: "error",
      code: "cap-height-range",
      message: "Cap height must be between 0 and the diameter."
    });
  }
  if (state.lamella.sectors < 3 || state.ribbedRectangular.ribs < 3) {
    messages.push({
      level: "error",
      code: "sector-rib-minimum",
      message: "Sector and rib counts must be at least 3."
    });
  }
  if (state.lamella.rings < 1 || state.ribbedRectangular.rings < 1) {
    messages.push({ level: "error", code: "ring-minimum", message: "Ring count must be at least 1." });
  }
  return messages;
};
