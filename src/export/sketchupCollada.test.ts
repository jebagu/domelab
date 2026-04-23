import { describe, expect, it } from "vitest";
import { buildProject } from "../buildProject";
import { normalizeProjectState } from "../configuration";
import { defaultProject } from "../data/defaultProject";
import { createSketchupCollada } from "./sketchupCollada";

describe("SketchUp COLLADA export", () => {
  it("exports a meter-scaled COLLADA scene with grouped tube geometry", () => {
    const built = buildProject(defaultProject);
    const dae = createSketchupCollada(built, defaultProject);

    expect(dae).toContain('<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">');
    expect(dae).toContain('<unit name="meter" meter="1"/>');
    expect(dae).toContain("<up_axis>Z_UP</up_axis>");
    expect(dae).toContain("Struts");
    expect(dae).toContain("<triangles");
    expect(dae).not.toMatch(/NaN|Infinity/);
  });

  it("includes local ring node geometry when ring nodes are selected", () => {
    const state = normalizeProjectState({
      ...defaultProject,
      nodes: {
        ...defaultProject.nodes,
        kind: "rings"
      }
    });
    const built = buildProject(state);
    const dae = createSketchupCollada(built, state);

    expect(dae).toContain("Ring nodes");
    expect(dae).toContain("ring_nodes_mesh");
  });
});
