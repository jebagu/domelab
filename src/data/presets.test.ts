import { describe, expect, it } from "vitest";
import { buildBom } from "../bom";
import { generateGeometry } from "../geometry";
import { projectPresets } from "./presets";

describe("project presets", () => {
  it("exposes the curated real-world presets", () => {
    expect(projectPresets.map((preset) => preset.id)).toEqual([
      "KA1",
      "KA2",
      "KA3",
      "KA4",
      "KA5",
      "KA6",
      "KA7",
      "KA8",
      "KA9",
      "KA10",
      "KA11"
    ]);
  });

  it("normalizes preset pricing to USD", () => {
    expect(projectPresets.every((preset) => preset.state.project.currency === "USD")).toBe(true);
  });

  it("captures KA1 as an 8V 5/8 geodesic cap", () => {
    const preset = projectPresets.find((candidate) => candidate.id === "KA1");
    expect(preset).toBeDefined();

    const state = preset!.state;
    const built = buildBom(generateGeometry(state), state);

    expect(state.geometry.pattern).toBe("geodesic");
    expect(state.geometry.shape).toBe("spherical-cap");
    expect(state.geometry.sphereCoverage).toBeCloseTo(0.625);
    expect(state.geodesic.frequency).toBe(8);
    expect(state.geometry.diameterM).toBe(27);
    expect(state.connectorSystem).toBe("ball-hub");
    expect(built.geometry.warnings.some((warning) => warning.level === "error")).toBe(false);
  });

  it("fits KA8 Chateau du Fey as a 3V geodesic dome from the Christie parts list", () => {
    const preset = projectPresets.find((candidate) => candidate.id === "KA8");
    expect(preset).toBeDefined();

    const state = preset!.state;
    const built = buildBom(generateGeometry(state), state);
    const strutGroups = [...built.bom.strutGroups].sort((a, b) => a.cutLengthM - b.cutLengthM);

    expect(state.geometry.pattern).toBe("geodesic");
    expect(state.geometry.shape).toBe("full-sphere");
    expect(state.geodesic.frequency).toBe(3);
    expect(state.geometry.diameterM).toBeCloseTo(7.1667, 4);
    expect(state.project.currency).toBe("USD");
    expect(state.material.costPerMeter).toBeCloseTo(17.4172, 4);
    expect(state.material.endOperationCostPerEnd).toBeCloseTo(0, 4);
    expect(state.material.setupCost).toBeCloseTo(0, 4);
    expect(state.connectors.flattenedBolted.holeDiameterMm).toBe(12);
    expect(state.connectors.flattenedBolted.holeOffsetMm).toBe(20);
    expect(state.connectors.flattenedBolted.flattenCompensationMm).toBe(0);
    expect(state.reference?.parts).toHaveLength(10);
    expect(state.reference?.pricingSummary?.[0]).toContain("7,361.56");
    expect(state.reference?.parts.find((part) => part.id === "A")?.unitPriceUsd).toBeCloseTo(22.46, 2);

    expect(strutGroups.map((group) => group.quantity)).toEqual([60, 90, 120]);
    expect(strutGroups[0].fabricationLengthM).toBeCloseTo(1.249, 3);
    expect(strutGroups[1].fabricationLengthM).toBeCloseTo(1.446, 3);
    expect(strutGroups[2].fabricationLengthM).toBeCloseTo(1.478, 3);
    expect(strutGroups[0].cutLengthM).toBeCloseTo(1.289, 3);
    expect(strutGroups[1].cutLengthM).toBeCloseTo(1.486, 3);
    expect(strutGroups[2].cutLengthM).toBeCloseTo(1.518, 3);
    expect(built.bom.costs.total).toBeCloseTo(6849.15, 2);
  });

  it("preserves the Burning Man reference cost package on the lamella presets", () => {
    const ka9 = projectPresets.find((candidate) => candidate.id === "KA9");
    const ka10 = projectPresets.find((candidate) => candidate.id === "KA10");

    expect(ka9).toBeDefined();
    expect(ka10).toBeDefined();

    const ka9State = ka9!.state;
    const ka10State = ka10!.state;
    const ka9Parts = ka9State.reference?.parts ?? [];

    expect(ka9State.geometry.pattern).toBe("lamella");
    expect(ka9Parts).toHaveLength(30);
    expect(ka9Parts.reduce((sum, part) => sum + part.quantity, 0)).toBe(645);
    expect(ka9State.reference?.pricingSummary?.[0]).toContain("37,111.65");
    expect(ka9Parts.find((part) => part.id === "H4L")?.tubeType).toBe('2.0" 11 GA');
    expect(ka9Parts.find((part) => part.id === "D5L")?.lineTotalUsd).toBeCloseTo(1529.2, 2);

    expect(ka10State.geometry.pattern).toBe("lamella");
    expect(ka10State.reference?.parts).toEqual(ka9State.reference?.parts);
    expect(ka10State.reference?.pricingSummary).toEqual(ka9State.reference?.pricingSummary);
    expect(ka10State.reference?.note).toContain("same reference cost package as KA9");
  });

  it("captures KA11 New York as a lamella-style sphere with reference schedule data", () => {
    const preset = projectPresets.find((candidate) => candidate.id === "KA11");
    expect(preset).toBeDefined();

    const state = preset!.state;
    const parts = state.reference?.parts ?? [];

    expect(state.geometry.pattern).toBe("lamella");
    expect(state.geometry.shape).toBe("full-sphere");
    expect(state.geometry.diameterM).toBeCloseTo(19.5072, 4);
    expect(state.lamella.sectors).toBe(22);
    expect(state.lamella.rings).toBe(19);
    expect(state.material.costPerMeter).toBeNull();
    expect(state.material.stockLengthM).toBeNull();
    expect(state.material.wasteFactor).toBeNull();
    expect(state.material.materialName).toBe("A36 steel or equivalent");
    expect(parts).toHaveLength(43);
    expect(parts.reduce((sum, part) => sum + part.quantity, 0)).toBe(1166);
    expect(parts.reduce((sum, part) => sum + (part.spares ?? 0), 0)).toBe(80);
    expect(parts.reduce((sum, part) => sum + (part.totalQuantity ?? part.quantity), 0)).toBe(1246);
    expect(parts.find((part) => part.id === "H11")?.fabricationLengthM).toBeCloseTo(2.611, 3);
    expect(parts.find((part) => part.id === "H11")?.cutLengthM).toBeCloseTo(2.705, 3);
    expect(parts.find((part) => part.id === "H8")?.tubeType).toBe("2NPS-12GA");
  });
});
