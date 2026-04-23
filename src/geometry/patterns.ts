import type { EdgeRole, ProjectState, ValidationMessage } from "../types";
import { createSurfaceModel, type SurfaceModel } from "./surfaceModel";
import { generateGeodesic } from "./geodesic";
import { cross, distance, dot, normalize, scale, sortedPairKey, sub, type Vec3 } from "./vector";

export interface RawPatternEdge {
  a: string;
  b: string;
  role?: EdgeRole;
}

export interface RawPatternGeometry {
  positions: Map<string, Vec3>;
  nodeFrames: Map<string, { normal: Vec3; tangentX: Vec3; tangentY: Vec3 }>;
  edges: RawPatternEdge[];
  faces: Array<[string, string, string]>;
  warnings: ValidationMessage[];
  baseZ?: number;
  topZ?: number;
}

interface Ring {
  ids: string[];
  uValues: number[];
  z: number;
}

interface GridBuildOptions {
  bands: number;
  sectors: number;
  targetSpacingM: number;
  spacingMode: "equal-height" | "equal-angle" | "equal-arc";
  offsetForRing?: (ringIndex: number, count: number) => number;
}

export const generatePatternGeometry = (state: ProjectState): RawPatternGeometry => {
  const surface = createSurfaceModel(state.surface);
  const warnings = collectCompatibilityWarnings(state, surface);

  if (state.pattern.kind === "triangles") {
    return mergeWarnings(generateTriangles(surface, state), warnings);
  }
  if (state.pattern.kind === "hexagons-pentagons") {
    return mergeWarnings(generateHexPent(surface, state), warnings);
  }
  if (state.pattern.kind === "diamonds") {
    return mergeWarnings(generateDiamonds(surface, state), warnings);
  }
  if (state.pattern.kind === "penrose") {
    return mergeWarnings(generatePenrose(surface, state), warnings);
  }
  if (state.pattern.kind === "quads") {
    return mergeWarnings(generateQuads(surface, state), warnings);
  }
  if (state.pattern.kind === "geodesic") {
    return mergeWarnings(generateAdaptedGeodesic(surface, state), warnings);
  }
  if (state.pattern.kind === "lamella") {
    return mergeWarnings(generateLamellaPattern(surface, state), warnings);
  }
  if (state.pattern.kind === "schwedler-ribbed") {
    return mergeWarnings(generateSchwedler(surface, state), warnings);
  }
  if (state.pattern.kind === "kiewitt") {
    return mergeWarnings(generateKiewitt(surface, state), warnings);
  }
  if (state.pattern.kind === "three-way-grid") {
    return mergeWarnings(generateThreeWay(surface, state), warnings);
  }
  if (state.pattern.kind === "gridshell") {
    return mergeWarnings(generateGridshell(surface, state), warnings);
  }
  return mergeWarnings(generateReciprocalFrame(surface, state), warnings);
};

const generateTriangles = (surface: SurfaceModel, state: ProjectState): RawPatternGeometry => {
  const edgeLength = state.pattern.triangles.targetEdgeLengthM * (state.pattern.triangles.equalEdgePreference ? 1 : 0.9);
  const sectors = preferredSectorCount(surface, edgeLength);
  const bands = Math.max(state.pattern.triangles.frequency * 2, Math.round(surface.heightM / Math.max(0.15, edgeLength)));
  const rings = buildRingGrid(surface, {
    bands,
    sectors,
    targetSpacingM: edgeLength,
    spacingMode: "equal-height",
    offsetForRing: (ringIndex, count) =>
      state.pattern.triangles.triangulationMethod === "alternating" && count > 1 && ringIndex % 2 === 1
        ? 0.5 / count
        : 0
  });
  const raw = createEmptyRaw(surface, rings);
  addLoopEdges(raw.edges, rings);
  addMeridianEdges(raw.edges, rings, "interior");
  addTriangulatedBands(raw.edges, raw.faces, rings, state.pattern.triangles.triangulationMethod);
  return raw;
};

const generateQuads = (surface: SurfaceModel, state: ProjectState): RawPatternGeometry => {
  const rings = buildRingGrid(surface, {
    bands: state.pattern.quads.vDivisions,
    sectors: state.pattern.quads.uDivisions,
    targetSpacingM: surface.maxDiameterM / Math.max(4, state.pattern.quads.uDivisions),
    spacingMode: "equal-height"
  });
  const raw = createEmptyRaw(surface, rings);
  addLoopEdges(raw.edges, rings);
  addMeridianEdges(raw.edges, rings, "rib");
  addQuadFaces(raw.faces, rings, state.pattern.quads.quadAspectPreference === "vertical");
  if (state.pattern.quads.diagonalBracing) {
    addAlternatingDiagonals(raw.edges, rings, "alternating");
  }
  return raw;
};

const generateSchwedler = (surface: SurfaceModel, state: ProjectState): RawPatternGeometry => {
  const rings = buildRingGrid(surface, {
    bands: state.pattern.schwedlerRibbed.horizontalRings,
    sectors: state.pattern.schwedlerRibbed.meridionalRibs,
    targetSpacingM: surface.maxDiameterM / Math.max(4, state.pattern.schwedlerRibbed.meridionalRibs),
    spacingMode: state.pattern.schwedlerRibbed.ribSpacingMode
  });
  const raw = createEmptyRaw(surface, rings);
  addLoopEdges(raw.edges, rings);
  addMeridianEdges(raw.edges, rings, "rib");
  addQuadFaces(raw.faces, rings, false);
  if (state.pattern.schwedlerRibbed.diagonalBracing) {
    addAlternatingDiagonals(raw.edges, rings, "alternating");
  }
  return raw;
};

const generateKiewitt = (surface: SurfaceModel, state: ProjectState): RawPatternGeometry => {
  const bands = Math.max(state.pattern.kiewitt.hoopRings, state.pattern.kiewitt.subdivisionCount);
  const rings = buildRingGrid(surface, {
    bands,
    sectors: state.pattern.kiewitt.radialRibs,
    targetSpacingM: surface.maxDiameterM / Math.max(4, state.pattern.kiewitt.radialRibs),
    spacingMode: "equal-arc",
    offsetForRing: (ringIndex, count) =>
      state.pattern.kiewitt.triangulationMode === "alternating" && ringIndex % 2 === 1 && count > 1 ? 0.5 / count : 0
  });
  const raw = createEmptyRaw(surface, rings);
  addLoopEdges(raw.edges, rings);
  addMeridianEdges(raw.edges, rings, "rib");
  addTriangulatedBands(
    raw.edges,
    raw.faces,
    rings,
    state.pattern.kiewitt.triangulationMode === "fan" ? "radial" : "alternating"
  );
  return raw;
};

const generateThreeWay = (surface: SurfaceModel, state: ProjectState): RawPatternGeometry => {
  const target = state.pattern.threeWayGrid.targetEdgeLengthM / Math.max(0.25, state.pattern.threeWayGrid.gridDensity);
  const sectors = preferredSectorCount(surface, target);
  const bands = Math.max(4, Math.round(surface.heightM / Math.max(0.15, target)));
  const rings = buildRingGrid(surface, {
    bands,
    sectors,
    targetSpacingM: target,
    spacingMode: "equal-arc",
    offsetForRing: (ringIndex, count) =>
      state.pattern.threeWayGrid.ringAlignmentPreference === "aligned" || count <= 1 || ringIndex % 2 === 0 ? 0 : 0.5 / count
  });
  const raw = createEmptyRaw(surface, rings);
  addLoopEdges(raw.edges, rings);
  addMeridianEdges(raw.edges, rings, "interior");
  addTriangulatedBands(
    raw.edges,
    raw.faces,
    rings,
    state.pattern.threeWayGrid.triangulationOrientation === "clockwise"
      ? "bias-right"
      : state.pattern.threeWayGrid.triangulationOrientation === "counterclockwise"
        ? "bias-left"
        : "alternating"
  );
  return raw;
};

const generateGridshell = (surface: SurfaceModel, state: ProjectState): RawPatternGeometry => {
  const spacing = state.pattern.gridshell.gridSpacingM;
  const biasedSectors = Math.max(
    6,
    Math.round(preferredSectorCount(surface, spacing) * (1 + state.pattern.gridshell.principalDirectionBias * 0.35))
  );
  const bands = Math.max(
    3,
    Math.round(
      (surface.heightM / Math.max(0.15, spacing)) *
        (1 + state.pattern.gridshell.curvatureAdaptationStiffness * 0.4)
    )
  );
  const rings = buildRingGrid(surface, {
    bands,
    sectors: biasedSectors,
    targetSpacingM: spacing,
    spacingMode: state.pattern.gridshell.curvatureAdaptationStiffness > 0.5 ? "equal-arc" : "equal-height"
  });
  const raw = createEmptyRaw(surface, rings);
  addLoopEdges(raw.edges, rings);
  addMeridianEdges(raw.edges, rings, "interior");
  addQuadFaces(raw.faces, rings, false);
  if (state.pattern.gridshell.shellMode === "triangulated") {
    addAlternatingDiagonals(raw.edges, rings, "alternating");
  }
  return raw;
};

const generateDiamonds = (surface: SurfaceModel, state: ProjectState): RawPatternGeometry => {
  const spacing = Math.max(0.15, state.pattern.diamonds.diamondWidthM / Math.max(0.25, state.pattern.diamonds.density));
  const sectors = preferredSectorCount(surface, spacing);
  const bands = Math.max(3, Math.round(surface.heightM / Math.max(0.15, state.pattern.diamonds.diamondHeightM)));
  const baseRotation = state.pattern.diamonds.gridRotationDeg / 360;
  const rings = buildRingGrid(surface, {
    bands,
    sectors,
    targetSpacingM: spacing,
    spacingMode: "equal-height",
    offsetForRing: (ringIndex, count) => baseRotation + (count > 1 && ringIndex % 2 === 1 ? 0.5 / count : 0)
  });
  const raw = createEmptyRaw(surface, rings);
  addLoopEdges(raw.edges, rings);
  addDiamondConnections(raw.edges, rings);
  return raw;
};

const generateLamellaPattern = (surface: SurfaceModel, state: ProjectState): RawPatternGeometry => {
  const sectors = state.pattern.lamella.sectors;
  const bands = state.pattern.lamella.horizontalRings;
  const rotationPerBand = state.pattern.lamella.lamellaAngleDeg / 360;
  const rings = buildRingGrid(surface, {
    bands,
    sectors,
    targetSpacingM: surface.maxDiameterM / Math.max(4, sectors),
    spacingMode: state.pattern.lamella.spacingMode,
    offsetForRing: (ringIndex) => rotationPerBand * ringIndex
  });
  const raw = createEmptyRaw(surface, rings);
  addLoopEdges(raw.edges, rings);
  addLamellaConnections(raw.edges, rings);
  return raw;
};

const generateAdaptedGeodesic = (surface: SurfaceModel, state: ProjectState): RawPatternGeometry => {
  const base = generateGeodesic(state.geometry, state.geodesic);
  const sourceZ = extent(base.nodes.map((node) => node.position[2]));
  const positions = new Map<string, Vec3>();
  const nodeFrames = new Map<string, { normal: Vec3; tangentX: Vec3; tangentY: Vec3 }>();

  base.nodes.forEach((node) => {
    const mapped = projectSphericalNodeToSurface(surface, node.position, sourceZ.min, sourceZ.max);
    positions.set(node.id, mapped.position);
    nodeFrames.set(node.id, {
      normal: mapped.normal,
      tangentX: tangentBasis(mapped.normal).tangentX,
      tangentY: tangentBasis(mapped.normal).tangentY
    });
  });

  return {
    positions,
    nodeFrames,
    edges: base.edges.map((edge) => ({ a: edge.nodeA, b: edge.nodeB, role: edge.role })),
    faces: base.faces.map((face) => [...face.nodeIds]),
    warnings: [],
    baseZ: surface.zMin,
    topZ: surface.zMax
  };
};

const generateHexPent = (surface: SurfaceModel, state: ProjectState): RawPatternGeometry => {
  const geodesic = generateAdaptedGeodesic(surface, {
    ...state,
    geodesic: {
      ...state.geodesic,
      frequency: Math.max(
        1,
        Math.min(8, Math.round(surface.maxDiameterM / Math.max(0.35, state.pattern.hexagonsPentagons.targetCellSizeM) / 2.5))
      ) as ProjectState["geodesic"]["frequency"]
    }
  });
  const adjacency = new Map<string, string[]>();
  geodesic.faces.forEach((face, faceIndex) => {
    const faceId = `hf${faceIndex}`;
    adjacency.set(faceId, []);
  });

  const edgeToFaces = new Map<string, number[]>();
  geodesic.faces.forEach((face, faceIndex) => {
    [
      [face[0], face[1]],
      [face[1], face[2]],
      [face[2], face[0]]
    ].forEach(([a, b]) => {
      const key = sortedPairKey(a, b);
      const list = edgeToFaces.get(key) ?? [];
      list.push(faceIndex);
      edgeToFaces.set(key, list);
    });
  });

  const positions = new Map<string, Vec3>();
  const nodeFrames = new Map<string, { normal: Vec3; tangentX: Vec3; tangentY: Vec3 }>();

  geodesic.faces.forEach((face, faceIndex) => {
    const nodeId = `hf${faceIndex}`;
    const vertices = face.map((id) => geodesic.positions.get(id)!);
    const center = averagePoint(vertices);
    const normal = normalize(averagePoint(face.map((id) => nodeFramesFromMap(geodesic.nodeFrames, id).normal)));
    positions.set(nodeId, center);
    nodeFrames.set(nodeId, {
      normal,
      tangentX: tangentBasis(normal).tangentX,
      tangentY: tangentBasis(normal).tangentY
    });
  });

  const edges: RawPatternEdge[] = [];
  edgeToFaces.forEach((faceIndices) => {
    if (faceIndices.length === 2) {
      edges.push({ a: `hf${faceIndices[0]}`, b: `hf${faceIndices[1]}`, role: "interior" });
    }
  });

  return {
    positions,
    nodeFrames,
    edges,
    faces: [],
    warnings: state.pattern.hexagonsPentagons.triangulateForStructure
      ? [
          {
            level: "info",
            code: "hex-pent-secondary-triangulation",
            message: "Hexagon/pentagon mode is panelization-first. Structure-facing export assumes a hidden triangulated subframe."
          }
        ]
      : [],
    baseZ: surface.zMin,
    topZ: surface.zMax
  };
};

const generatePenrose = (surface: SurfaceModel, state: ProjectState): RawPatternGeometry => {
  const base = generateDiamonds(surface, {
    ...state,
    pattern: {
      ...state.pattern,
      kind: "diamonds",
      diamonds: {
        ...state.pattern.diamonds,
        diamondWidthM: state.pattern.penrose.tileScaleM,
        diamondHeightM: state.pattern.penrose.tileScaleM * 0.9,
        density: 1.2,
        gridRotationDeg: 360 / 5
      }
    }
  });
  return {
    ...base,
    warnings: [
      {
        level: "warning",
        code: "penrose-adapted-preview",
        message:
          "Penrose mode is an adapted aperiodic preview mapped onto the dome. Treat it as panelization-first unless you add a structural subframe."
      },
      ...(state.pattern.penrose.triangulateForStructure
        ? [
            {
              level: "info" as const,
              code: "penrose-secondary-triangulation",
              message: "Hidden structural triangulation is assumed for stiffness and connection logic."
            }
          ]
        : [])
    ]
  };
};

const generateReciprocalFrame = (surface: SurfaceModel, state: ProjectState): RawPatternGeometry => {
  const rings = buildRingGrid(surface, {
    bands: Math.max(1, state.pattern.reciprocalFrame.concentricTierCount - 1),
    sectors: state.pattern.reciprocalFrame.membersPerRing,
    targetSpacingM: surface.maxDiameterM / Math.max(4, state.pattern.reciprocalFrame.membersPerRing),
    spacingMode: "equal-height",
    offsetForRing: (ringIndex) => (state.pattern.reciprocalFrame.rotationalOffsetDeg / 360) * ringIndex
  });
  const raw = createEmptyRaw(surface, rings);
  const skip = Math.max(1, Math.round((state.pattern.reciprocalFrame.rotationalOffsetDeg / 360) * rings[0].ids.length));

  rings.forEach((ring, ringIndex) => {
    if (ring.ids.length <= 2) return;
    for (let index = 0; index < ring.ids.length; index += 1) {
      raw.edges.push({
        a: ring.ids[index],
        b: ring.ids[(index + skip + 1) % ring.ids.length],
        role: ringIndex === rings.length - 1 ? "base-ring" : "diagonal"
      });
    }
  });

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    connectNearest(rings[ringIndex], rings[ringIndex + 1], raw.edges, 1, "boundary");
  }

  raw.warnings.push({
    level: "warning",
    code: "reciprocal-frame-preview",
    message:
      "Reciprocal frame mode is a cyclic overlap preview. Check member overlap, curvature, and assembly sequence before fabrication."
  });

  return raw;
};

const buildRingGrid = (surface: SurfaceModel, options: GridBuildOptions): Ring[] => {
  const positions = [];
  for (let ringIndex = 0; ringIndex <= options.bands; ringIndex += 1) {
    const t = spaceFraction(ringIndex / Math.max(1, options.bands), options.spacingMode);
    positions.push(surface.zMax - t * surface.heightM);
  }

  return positions.map((z, ringIndex) => {
    const circumference = surface.circumferenceAt(z);
    const diameter = circumference / Math.PI;
    const isCollapsedApex = ringIndex === 0 && surface.topOpeningDiameterM <= 1e-6 && diameter < options.targetSpacingM * 0.7;
    const count = isCollapsedApex ? 1 : Math.max(3, options.sectors);
    const offset = options.offsetForRing?.(ringIndex, count) ?? 0;
    const ids: string[] = [];
    const uValues: number[] = [];
    for (let sectorIndex = 0; sectorIndex < count; sectorIndex += 1) {
      uValues.push(wrap01(count === 1 ? 0 : sectorIndex / count + offset));
      ids.push(`g${ringIndex}-${sectorIndex}`);
    }
    return { ids, uValues, z };
  });
};

const createEmptyRaw = (surface: SurfaceModel, rings: Ring[]): RawPatternGeometry => {
  const positions = new Map<string, Vec3>();
  const nodeFrames = new Map<string, { normal: Vec3; tangentX: Vec3; tangentY: Vec3 }>();

  rings.forEach((ring) => {
    ring.ids.forEach((id, index) => {
      const sample = surface.sampleAt(ring.z, ring.uValues[index] * Math.PI * 2);
      const basis = tangentBasis(sample.normal);
      positions.set(id, sample.position);
      nodeFrames.set(id, { normal: sample.normal, tangentX: basis.tangentX, tangentY: basis.tangentY });
    });
  });

  return { positions, nodeFrames, edges: [], faces: [], warnings: [], baseZ: surface.zMin, topZ: surface.zMax };
};

const addLoopEdges = (edges: RawPatternEdge[], rings: Ring[]) => {
  rings.forEach((ring, ringIndex) => {
    if (ring.ids.length <= 2) return;
    const role: EdgeRole =
      ringIndex === 0 ? "crown-ring" : ringIndex === rings.length - 1 ? "base-ring" : "hoop";
    for (let index = 0; index < ring.ids.length; index += 1) {
      edges.push({ a: ring.ids[index], b: ring.ids[(index + 1) % ring.ids.length], role });
    }
  });
};

const addMeridianEdges = (edges: RawPatternEdge[], rings: Ring[], role: EdgeRole) => {
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    connectNearest(rings[ringIndex], rings[ringIndex + 1], edges, 1, role);
  }
};

const addDiamondConnections = (edges: RawPatternEdge[], rings: Ring[]) => {
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    connectNearest(rings[ringIndex], rings[ringIndex + 1], edges, 2, "diagonal");
  }
};

const addLamellaConnections = (edges: RawPatternEdge[], rings: Ring[]) => {
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    connectNearest(rings[ringIndex], rings[ringIndex + 1], edges, 2, "diagonal");
  }
};

const addTriangulatedBands = (
  edges: RawPatternEdge[],
  faces: Array<[string, string, string]>,
  rings: Ring[],
  mode: "alternating" | "bias-left" | "bias-right" | "radial"
) => {
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const upper = rings[ringIndex];
    const lower = rings[ringIndex + 1];
    if (upper.ids.length === 1) {
      for (let index = 0; index < lower.ids.length; index += 1) {
        faces.push([upper.ids[0], lower.ids[index], lower.ids[(index + 1) % lower.ids.length]]);
        edges.push({ a: upper.ids[0], b: lower.ids[index], role: "diagonal" });
      }
      continue;
    }

    const count = Math.min(upper.ids.length, lower.ids.length);
    for (let index = 0; index < count; index += 1) {
      const nextUpper = upper.ids[(index + 1) % upper.ids.length];
      const nextLower = lower.ids[(index + 1) % lower.ids.length];
      const flip =
        mode === "bias-left"
          ? false
          : mode === "bias-right"
            ? true
            : mode === "radial"
              ? ringIndex % 2 === 0
              : (ringIndex + index) % 2 === 1;

      if (flip) {
        edges.push({ a: upper.ids[index], b: nextLower, role: "diagonal" });
        faces.push([upper.ids[index], lower.ids[index], nextLower]);
        faces.push([upper.ids[index], nextLower, nextUpper]);
      } else {
        edges.push({ a: nextUpper, b: lower.ids[index], role: "diagonal" });
        faces.push([upper.ids[index], lower.ids[index], nextUpper]);
        faces.push([nextUpper, lower.ids[index], nextLower]);
      }
    }
  }
};

const addAlternatingDiagonals = (
  edges: RawPatternEdge[],
  rings: Ring[],
  mode: "alternating" | "forward"
) => {
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const upper = rings[ringIndex];
    const lower = rings[ringIndex + 1];
    if (upper.ids.length === 1 || lower.ids.length === 1) continue;
    const count = Math.min(upper.ids.length, lower.ids.length);
    for (let index = 0; index < count; index += 1) {
      const forward = mode === "forward" || (ringIndex + index) % 2 === 0;
      edges.push({
        a: upper.ids[index],
        b: lower.ids[forward ? (index + 1) % lower.ids.length : index],
        role: "diagonal"
      });
    }
  }
};

const addQuadFaces = (faces: Array<[string, string, string]>, rings: Ring[], verticalBias: boolean) => {
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const upper = rings[ringIndex];
    const lower = rings[ringIndex + 1];
    if (upper.ids.length === 1 || lower.ids.length === 1) {
      for (let index = 0; index < lower.ids.length; index += 1) {
        faces.push([upper.ids[0], lower.ids[index], lower.ids[(index + 1) % lower.ids.length]]);
      }
      continue;
    }
    const count = Math.min(upper.ids.length, lower.ids.length);
    for (let index = 0; index < count; index += 1) {
      const nextUpper = upper.ids[(index + 1) % upper.ids.length];
      const nextLower = lower.ids[(index + 1) % lower.ids.length];
      if (verticalBias) {
        faces.push([upper.ids[index], lower.ids[index], nextLower]);
        faces.push([upper.ids[index], nextLower, nextUpper]);
      } else {
        faces.push([upper.ids[index], lower.ids[index], nextUpper]);
        faces.push([nextUpper, lower.ids[index], nextLower]);
      }
    }
  }
};

const connectNearest = (upper: Ring, lower: Ring, edges: RawPatternEdge[], fanCount: number, role: EdgeRole) => {
  if (upper.ids.length === 1) {
    lower.ids.forEach((id) => edges.push({ a: upper.ids[0], b: id, role }));
    return;
  }
  if (lower.ids.length === 1) {
    upper.ids.forEach((id) => edges.push({ a: id, b: lower.ids[0], role }));
    return;
  }
  upper.uValues.forEach((u, index) => {
    const nearest = rankedNearestIndices(u, lower.uValues, fanCount);
    nearest.forEach((target) => edges.push({ a: upper.ids[index], b: lower.ids[target], role }));
  });
};

const rankedNearestIndices = (u: number, targets: number[], count: number): number[] =>
  targets
    .map((target, index) => ({ index, distance: circularDistance(u, target) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map((item) => item.index);

const projectSphericalNodeToSurface = (
  surface: SurfaceModel,
  point: Vec3,
  sourceMinZ: number,
  sourceMaxZ: number
): { position: Vec3; normal: Vec3 } => {
  const t = (point[2] - sourceMinZ) / Math.max(1e-6, sourceMaxZ - sourceMinZ);
  const z = surface.zMin + t * surface.heightM;
  const phi = Math.atan2(point[1], point[0]);
  const sample = surface.sampleAt(z, phi);
  return { position: sample.position, normal: sample.normal };
};

const collectCompatibilityWarnings = (state: ProjectState, surface: SurfaceModel): ValidationMessage[] => {
  const warnings: ValidationMessage[] = [];
  if (state.pattern.kind === "geodesic" && state.surface.kind !== "spherical") {
    warnings.push({
      level: "warning",
      code: "geodesic-adapted-non-spherical",
      message: `${state.surface.kind.charAt(0).toUpperCase() + state.surface.kind.slice(1)} + geodesic uses an adapted surface projection. The result is geodesic-derived, not a pure geodesic.`
    });
  }
  if (state.pattern.kind === "hexagons-pentagons" && !state.pattern.hexagonsPentagons.triangulateForStructure) {
    warnings.push({
      level: "warning",
      code: "hex-pent-panelization-first",
      message: "Hexagons/pentagons is panelization-first. Add hidden or visible triangulation if the lattice must carry structure directly."
    });
  }
  if (state.pattern.kind === "reciprocal-frame" && surface.maxDiameterM / Math.max(0.05, surface.heightM) > 4) {
    warnings.push({
      level: "warning",
      code: "reciprocal-frame-shallow-shell",
      message: "Reciprocal frame geometry is very shallow for the selected span. Check overlap and support logic carefully."
    });
  }
  if (state.nodes.kind === "rings" && state.nodes.rings.maxAttachments !== null) {
    warnings.push({
      level: "info",
      code: "ring-attachment-limit-active",
      message: `Ring nodes are limited to ${state.nodes.rings.maxAttachments} attachments in the configurator warnings.`
    });
  }
  return warnings;
};

const mergeWarnings = (raw: RawPatternGeometry, warnings: ValidationMessage[]): RawPatternGeometry => ({
  ...raw,
  warnings: [...warnings, ...raw.warnings]
});

const nodeFramesFromMap = (
  nodeFrames: Map<string, { normal: Vec3; tangentX: Vec3; tangentY: Vec3 }>,
  id: string
): { normal: Vec3; tangentX: Vec3; tangentY: Vec3 } => nodeFrames.get(id)!;

const averagePoint = (points: Vec3[]): Vec3 =>
  scale(
    points.reduce<Vec3>((sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]], [0, 0, 0]),
    1 / Math.max(1, points.length)
  );

const tangentBasis = (normal: Vec3): { tangentX: Vec3; tangentY: Vec3 } => {
  const guide = Math.abs(normal[2]) > 0.85 ? [1, 0, 0] : [0, 0, 1];
  const tangentX = normalize(cross(guide as Vec3, normal));
  const tangentY = normalize(cross(normal, tangentX));
  return { tangentX, tangentY };
};

const preferredSectorCount = (surface: SurfaceModel, targetEdgeLengthM: number): number =>
  clampInteger(Math.round(surface.circumferenceAt(surface.zMin) / Math.max(0.12, targetEdgeLengthM)), 5, 240);

const extent = (values: number[]): { min: number; max: number } => ({
  min: Math.min(...values),
  max: Math.max(...values)
});

const circularDistance = (a: number, b: number): number => {
  const delta = Math.abs(wrap01(a) - wrap01(b));
  return Math.min(delta, 1 - delta);
};

const wrap01 = (value: number): number => ((value % 1) + 1) % 1;

const spaceFraction = (t: number, mode: GridBuildOptions["spacingMode"]): number => {
  if (mode === "equal-angle") return (1 - Math.cos(t * Math.PI)) / 2;
  if (mode === "equal-arc") return t * t * (3 - 2 * t);
  return t;
};

const clampInteger = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round(value)));
