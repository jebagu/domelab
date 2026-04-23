import { describe, expect, it } from "vitest";
import { defaultProject } from "../data/defaultProject";
import { generateLamella } from "./lamella";

describe("lamella generation", () => {
  it("keeps diagonal members local to adjacent sectors", () => {
    const sectors = 24;
    const result = generateLamella(
      { ...defaultProject.geometry, pattern: "lamella", shape: "hemisphere", diameterM: 6 },
      { ...defaultProject.lamella, sectors, rings: 8, style: "alternating", handedness: "alternating" }
    );
    const nodes = new Map(result.nodes.map((node) => [node.id, node]));
    const sectorAngle = (Math.PI * 2) / sectors;

    const longDiagonal = result.edges.find((edge) => {
      if (edge.role !== "diagonal") return false;
      const a = nodes.get(edge.nodeA)!;
      const b = nodes.get(edge.nodeB)!;
      const aRadius = Math.hypot(a.position[0], a.position[1]);
      const bRadius = Math.hypot(b.position[0], b.position[1]);
      if (aRadius < 1e-5 || bRadius < 1e-5) return false;
      return angularDistance(angleOf(a.position), angleOf(b.position)) > sectorAngle * 1.05;
    });

    expect(longDiagonal).toBeUndefined();
  });

  it("respects hoop, crown, and base ring toggles independently", () => {
    const result = generateLamella(
      { ...defaultProject.geometry, pattern: "lamella", shape: "hemisphere", diameterM: 6 },
      {
        ...defaultProject.lamella,
        sectors: 12,
        rings: 4,
        hoopRings: false,
        crownRing: false,
        baseRing: true
      }
    );

    expect(result.edges.some((edge) => edge.role === "hoop")).toBe(false);
    expect(result.edges.some((edge) => edge.role === "base-ring")).toBe(true);
  });
});

const angleOf = ([x, y]: [number, number, number]): number => Math.atan2(y, x);

const angularDistance = (a: number, b: number): number => {
  const tau = Math.PI * 2;
  return Math.abs(((((b - a) % tau) + Math.PI * 3) % tau) - Math.PI);
};
