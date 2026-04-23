import { describe, expect, it } from "vitest";
import { defaultProject } from "../data/defaultProject";
import {
  edgeCountFromFaces,
  generateGeodesic,
  geodesicExpectedCounts,
  listGeodesicNodeLayerZValues,
  snapGeodesicCoverageToNodeLayer
} from "./geodesic";
import type { GeodesicSettings, GeometrySettings } from "../types";

describe("geodesic full sphere generation", () => {
  ([1, 2, 3, 4, 5, 6, 7, 8] as const).forEach((frequency) => {
    it(`matches icosahedron Class I counts for ${frequency}V`, () => {
      const result = generateGeodesic(
        { ...defaultProject.geometry, shape: "full-sphere", diameterM: 6 },
        {
          ...defaultProject.geodesic,
          frequency
        } as GeodesicSettings
      );
      const expected = geodesicExpectedCounts(frequency);

      expect(result.nodes).toHaveLength(expected.vertices);
      expect(result.edges).toHaveLength(expected.edges);
      expect(result.faces).toHaveLength(expected.faces);
      expect(edgeCountFromFaces(result.faces)).toBe(result.edges.length);
    });
  });

  it("does not create duplicate vertices or zero-length struts", () => {
    const result = generateGeodesic(
      { ...defaultProject.geometry, shape: "full-sphere", diameterM: 6 },
      { ...defaultProject.geodesic, frequency: 6 }
    );
    const keys = new Set(result.nodes.map((node) => node.position.map((value) => value.toFixed(8)).join(",")));

    expect(keys.size).toBe(result.nodes.length);
    expect(result.edges.every((edge) => edge.modelLengthM > 0)).toBe(true);
  });

  it("keeps full-sphere nodes on the requested radius", () => {
    const radius = 3;
    const result = generateGeodesic(
      { ...defaultProject.geometry, shape: "full-sphere", diameterM: radius * 2 },
      { ...defaultProject.geodesic, frequency: 4 }
    );

    result.nodes.forEach((node) => {
      expect(Math.hypot(...node.position)).toBeCloseTo(radius, 8);
    });
  });

  it("clips hemispheres without invalid edge references", () => {
    const result = generateGeodesic(
      { ...defaultProject.geometry, shape: "hemisphere", diameterM: 6 },
      { ...defaultProject.geodesic, frequency: 3 }
    );
    const nodeIds = new Set(result.nodes.map((node) => node.id));

    expect(result.nodes.every((node) => node.position[2] >= -1e-7)).toBe(true);
    expect(result.edges.every((edge) => nodeIds.has(edge.nodeA) && nodeIds.has(edge.nodeB))).toBe(true);
  });

  it("adds a complete perimeter strut cycle for flattened bases", () => {
    const result = generateGeodesic(
      { ...defaultProject.geometry, shape: "flattened-base", diameterM: 6, cutPlaneZ: 0 },
      { ...defaultProject.geodesic, frequency: 3 }
    );
    const minZ = Math.min(...result.nodes.map((node) => node.position[2]));
    const eps = 0.003;
    const baseNodes = result.nodes.filter((node) => Math.abs(node.position[2] - minZ) < eps);
    const baseRingEdges = result.edges.filter((edge) => edge.role === "base-ring");
    const edgeKeys = new Set(baseRingEdges.map((edge) => [edge.nodeA, edge.nodeB].sort().join("|")));
    const sortedBaseNodes = [...baseNodes].sort(
      (a, b) => Math.atan2(a.position[1], a.position[0]) - Math.atan2(b.position[1], b.position[0])
    );

    expect(sortedBaseNodes.length).toBeGreaterThan(2);
    expect(baseRingEdges).toHaveLength(sortedBaseNodes.length);
    sortedBaseNodes.forEach((node, index) => {
      const next = sortedBaseNodes[(index + 1) % sortedBaseNodes.length];
      expect(edgeKeys.has([node.id, next.id].sort().join("|"))).toBe(true);
    });
  });

  it("keeps flattened-base boundary rings clean across multiple cut heights", () => {
    [-1.2, -0.6, 0, 0.6, 1.2].forEach((cutPlaneZ) => {
      const result = generateGeodesic(
        { ...defaultProject.geometry, shape: "flattened-base", diameterM: 6, cutPlaneZ },
        { ...defaultProject.geodesic, frequency: 4 }
      );
      const minZ = Math.min(...result.nodes.map((node) => node.position[2]));
      const eps = 0.0035;
      const baseNodes = result.nodes.filter((node) => Math.abs(node.position[2] - minZ) < eps);
      const baseNodeIds = new Set(baseNodes.map((node) => node.id));
      const baseRingEdges = result.edges.filter((edge) => edge.role === "base-ring");
      const nonRingBaseEdges = result.edges.filter(
        (edge) => baseNodeIds.has(edge.nodeA) && baseNodeIds.has(edge.nodeB) && edge.role !== "base-ring"
      );
      const baseRingValence = new Map(baseNodes.map((node) => [node.id, 0]));

      baseRingEdges.forEach((edge) => {
        baseRingValence.set(edge.nodeA, (baseRingValence.get(edge.nodeA) ?? 0) + 1);
        baseRingValence.set(edge.nodeB, (baseRingValence.get(edge.nodeB) ?? 0) + 1);
      });

      expect(baseNodes.length).toBeGreaterThan(2);
      expect(minZ).toBeCloseTo(cutPlaneZ, 6);
      expect(baseNodes.every((node) => Math.abs(node.position[2] - cutPlaneZ) < eps)).toBe(true);
      expect(baseRingEdges).toHaveLength(baseNodes.length);
      expect(nonRingBaseEdges).toHaveLength(0);
      expect([...baseRingValence.values()].every((count) => count === 2)).toBe(true);
    });
  });

  it("creates a continuous cut boundary for the 85 percent spherical-cap case", () => {
    const diameterM = 6;
    const coverage = 0.85;
    const radius = diameterM / 2;
    const cutPlaneZ = radius - diameterM * coverage;
    const result = generateGeodesic(
      { ...defaultProject.geometry, shape: "spherical-cap", diameterM, capHeightM: diameterM * coverage, cutPlaneZ },
      { ...defaultProject.geodesic, frequency: 3 }
    );
    const eps = 0.0005;
    const boundaryNodes = result.nodes.filter((node) => Math.abs(node.position[2] - cutPlaneZ) < eps);
    const boundaryNodeIds = new Set(boundaryNodes.map((node) => node.id));
    const boundaryEdges = result.edges.filter((edge) => boundaryNodeIds.has(edge.nodeA) && boundaryNodeIds.has(edge.nodeB));
    const boundaryValence = new Map(boundaryNodes.map((node) => [node.id, 0]));

    boundaryEdges.forEach((edge) => {
      boundaryValence.set(edge.nodeA, (boundaryValence.get(edge.nodeA) ?? 0) + 1);
      boundaryValence.set(edge.nodeB, (boundaryValence.get(edge.nodeB) ?? 0) + 1);
    });

    expect(boundaryNodes.length).toBeGreaterThan(2);
    expect(boundaryEdges.length).toBe(boundaryNodes.length);
    expect([...boundaryValence.values()].every((count) => count === 2)).toBe(true);
  });

  it("snaps coverage to the nearest geodesic node layer when requested", () => {
    const geometry: GeometrySettings = { ...defaultProject.geometry, shape: "spherical-cap", diameterM: 6 };
    const layers = listGeodesicNodeLayerZValues(geometry, { ...defaultProject.geodesic, frequency: 4 });
    const lower = layers[2];
    const upper = layers[3];
    const requestedCoverage = (geometry.diameterM / 2 - (lower * 0.4 + upper * 0.6)) / geometry.diameterM;
    const snappedCoverage = snapGeodesicCoverageToNodeLayer(
      geometry,
      { ...defaultProject.geodesic, frequency: 4 },
      requestedCoverage
    );
    const snappedBaseZ = geometry.diameterM / 2 - geometry.diameterM * snappedCoverage;

    expect(Math.abs(snappedBaseZ - upper)).toBeLessThan(1e-8);
  });

  it("uses the snapped node layer for clipped spherical caps", () => {
    const geometry: GeometrySettings = { ...defaultProject.geometry, shape: "spherical-cap", diameterM: 6 };
    const layers = listGeodesicNodeLayerZValues(geometry, { ...defaultProject.geodesic, frequency: 4 });
    const requestedBaseZ = (layers[2] + layers[3]) / 2;
    const requestedCoverage = (geometry.diameterM / 2 - requestedBaseZ) / geometry.diameterM;
    const result = generateGeodesic(
      {
        ...geometry,
        sphereCoverage: requestedCoverage,
        snapCoverageToNodeLayer: true,
        capHeightM: geometry.diameterM * requestedCoverage,
        cutPlaneZ: requestedBaseZ
      },
      { ...defaultProject.geodesic, frequency: 4 }
    );
    const snappedCoverage = snapGeodesicCoverageToNodeLayer(
      geometry,
      { ...defaultProject.geodesic, frequency: 4 },
      requestedCoverage
    );
    const expectedBaseZ = geometry.diameterM / 2 - geometry.diameterM * snappedCoverage;
    const minZ = Math.min(...result.nodes.map((node) => node.position[2]));

    expect(minZ).toBeCloseTo(expectedBaseZ, 8);
  });
});
