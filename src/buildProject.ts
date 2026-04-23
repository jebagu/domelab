import type { BuiltProject, ProjectState } from "./types";
import { buildBom } from "./bom";
import { generateGeometry } from "./geometry";
import { measureSync } from "./utils/debug";

export const buildProject = (state: ProjectState): BuiltProject =>
  measureSync(
    "build",
    "build-project",
    () => {
      const geometry = generateGeometry(state);
      const built = buildBom(geometry, state);
      return built;
    },
    summarizeState(state)
  );

const summarizeState = (state: ProjectState): Record<string, unknown> => ({
  pattern: state.geometry.pattern,
  shape: state.geometry.shape,
  diameterM: Number(state.geometry.diameterM.toFixed(3)),
  sphereCoverage: state.geometry.sphereCoverage ?? null,
  geodesicFrequency: state.geometry.pattern === "geodesic" ? state.geodesic.frequency : null,
  lamellaSectors: state.geometry.pattern === "lamella" ? state.lamella.sectors : null,
  lamellaRings: state.geometry.pattern === "lamella" ? state.lamella.rings : null,
  ribCount: state.geometry.pattern === "ribbed-rectangular" ? state.ribbedRectangular.ribs : null,
  ringCount: state.geometry.pattern === "ribbed-rectangular" ? state.ribbedRectangular.rings : null
});
