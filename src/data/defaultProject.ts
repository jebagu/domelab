import type { ProjectState } from "../types";
import { defaultNodeSettings, defaultPatternSettings, defaultSurfaceSettings, normalizeProjectState } from "../configuration";

export const defaultProject: ProjectState = normalizeProjectState({
  project: {
    units: "metric",
    currency: "USD",
    precisionMm: 1,
    lengthGroupToleranceMm: 1
  },
  surface: defaultSurfaceSettings,
  pattern: defaultPatternSettings,
  nodes: defaultNodeSettings,
  geometry: {
    pattern: "geodesic",
    shape: "hemisphere",
    diameterM: 6,
    sphereCoverage: 0.5,
    snapCoverageToNodeLayer: false,
    flatBase: false,
    capHeightM: 3,
    cutPlaneZ: 0,
    orientation: {
      mode: "vertex-up",
      rotationEuler: [0, 0, 0]
    }
  },
  geodesic: {
    frequency: 3,
    basePolyhedron: "icosahedron",
    subdivisionClass: "class-I"
  },
  lamella: {
    sectors: 24,
    rings: 8,
    style: "alternating",
    handedness: "alternating",
    hoopRings: true,
    crownRing: true,
    baseRing: true,
    triangulation: "none"
  },
  ribbedRectangular: {
    ribs: 24,
    rings: 8,
    ribMode: "segmented-straight",
    ringMode: "segmented-straight",
    diagonalBracing: "none"
  },
  connectorSystem: "flattened-drilled-bolted",
  connectors: {
    flattenedBolted: {
      holeDiameterMm: 10,
      holeOffsetMm: 20,
      flattenLengthMm: 50,
      flattenCompensationMm: 6,
      boltCost: 0.55,
      nutCost: 0.22,
      washerCost: 0.08
    },
    ballHub: {
      socketSeatOffsetMm: 28,
      trimAllowanceMm: 4,
      ballDiameterMm: 60,
      socketAdapterCost: 4.5,
      maxValence: 8
    },
    weldedNode: {
      weldSetbackMm: 12,
      copeAllowanceMm: 8,
      bevelDeg: 30,
      nodeShellCost: 7.5,
      weldCostPerEnd: 3.25
    }
  },
  material: {
    materialName: "",
    profileType: "round tube",
    profileLabel: "",
    strutDiameterMm: 25,
    costPerMeter: null,
    stockLengthM: null,
    wasteFactor: null,
    endOperationCostPerEnd: null,
    nodeBaseCost: null,
    nodePerStrutAdder: null,
    setupCost: null,
    contingencyPercent: null
  },
  reference: {
    sourceLabel: "",
    note: "",
    knownParameters: [],
    unknownParameters: [],
    pricingSummary: [],
    parts: []
  }
});
