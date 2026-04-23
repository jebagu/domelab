import { describe, expect, it } from "vitest";
import { buildProject } from "../buildProject";
import { defaultProject } from "../data/defaultProject";
import { metersToDisplay } from "../utils/format";
import { createQuoteDocumentXml, createQuoteLineItems } from "./quoteDocx";

describe("quote DOCX export", () => {
  it("uses nominal model length for the simplified BOM rows", () => {
    const built = buildProject(defaultProject);
    const rows = createQuoteLineItems(built, defaultProject);
    const firstStrut = built.bom.strutGroups[0];

    expect(rows[0]).toMatchObject({
      item: firstStrut.label,
      nominalLength: metersToDisplay(firstStrut.modelLengthM, defaultProject.project.units)
    });
    expect(rows[0]?.nominalLength).not.toBe(metersToDisplay(firstStrut.cutLengthM, defaultProject.project.units));
  });

  it("includes the quote sections and excludes fabrication wording", () => {
    const built = buildProject(defaultProject);
    const xml = createQuoteDocumentXml({
      built,
      state: defaultProject,
      images: [
        {
          widthPx: 960,
          heightPx: 720,
          relationshipId: "rId1",
          title: "Isometric view (Perspective)",
          docPrId: 1,
          filename: "isometric-perspective.png"
        },
        {
          widthPx: 960,
          heightPx: 720,
          relationshipId: "rId2",
          title: "Plan view (Axonometric)",
          docPrId: 2,
          filename: "plan-axonometric.png"
        }
      ]
    });

    expect(xml).toContain("Sphere size and geometry");
    expect(xml).toContain("Material and surface finish");
    expect(xml).toContain("Reference views");
    expect(xml).toContain("Isometric view (Perspective)");
    expect(xml).toContain("Plan view (Axonometric)");
    expect(xml).toContain("Nominal strut length");
    expect(xml).toContain("All items to be palletized.");
    expect(xml).toContain("EXW basis");
    expect(xml).toContain("packed weight and pallet dimensions");
    expect(xml).not.toContain("Cut length");
    expect(xml).not.toContain("End treatment");
  });
});
