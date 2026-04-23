import type { BuiltProject, ProjectState } from "./types";
import { buildBom } from "./bom";
import { generateGeometry } from "./geometry";
import { measureSync } from "./utils/debug";
import { surfacePrimaryDiameterM } from "./configuration";

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
  surface: state.surface.kind,
  pattern: state.pattern.kind,
  nodes: state.nodes.kind,
  diameterM: Number(surfacePrimaryDiameterM(state.surface).toFixed(3)),
  heightM: Number((state.geometry.topCutPlaneZ ?? state.geometry.diameterM / 2 - (state.geometry.bottomCutPlaneZ ?? state.geometry.cutPlaneZ ?? 0)).toFixed(3)),
  geodesicFrequency: state.pattern.kind === "geodesic" ? state.pattern.geodesic.frequency : null,
  lamellaSectors: state.pattern.kind === "lamella" ? state.pattern.lamella.sectors : null,
  lamellaRings: state.pattern.kind === "lamella" ? state.pattern.lamella.horizontalRings : null,
  ribCount: state.pattern.kind === "schwedler-ribbed" ? state.pattern.schwedlerRibbed.meridionalRibs : null,
  ringCount: state.pattern.kind === "schwedler-ribbed" ? state.pattern.schwedlerRibbed.horizontalRings : null
});
