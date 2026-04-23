import type {
  GeodesicSettings,
  GeometrySettings,
  LamellaSettings,
  NodeSettings,
  PatternKind,
  PatternSettings,
  ProjectState,
  RibbedRectangularSettings,
  StructurePattern,
  SurfaceGeometryKind,
  SurfaceSettings
} from "./types";

export const defaultSurfaceSettings: SurfaceSettings = {
  kind: "spherical",
  spherical: {
    diameterM: 6,
    radiusM: 3,
    domeHeightM: 3,
    baseDiameterM: 6,
    topOpeningDiameterM: 0,
    verticalCutPositionM: 0
  },
  ellipsoidal: {
    xDiameterM: 8,
    yDiameterM: 6,
    zHeightM: 6,
    truncationHeightM: 3,
    topOpeningDiameterM: 0
  },
  onion: {
    baseDiameterM: 7,
    shoulderHeightM: 2,
    maxBulgeDiameterM: 8.5,
    neckDiameterM: 3,
    apexHeightM: 5,
    overallHeightM: 6,
    topOpeningDiameterM: 0
  },
  catenary: {
    spanDiameterM: 8,
    heightM: 5,
    shapeFactor: 1.5,
    truncationHeightM: 5,
    topOpeningDiameterM: 0
  },
  paraboloid: {
    baseDiameterM: 8,
    heightM: 4,
    curvatureCoefficient: 1,
    truncationHeightM: 4,
    topOpeningDiameterM: 0
  }
};

export const defaultPatternSettings: PatternSettings = {
  kind: "geodesic",
  triangles: {
    targetEdgeLengthM: 0.9,
    frequency: 4,
    equalEdgePreference: true,
    triangulationMethod: "alternating"
  },
  hexagonsPentagons: {
    targetCellSizeM: 0.85,
    pentagonDistributionMode: "icosahedral",
    panelRegularityPreference: "regular",
    triangulateForStructure: false
  },
  diamonds: {
    diamondWidthM: 0.9,
    diamondHeightM: 0.9,
    gridRotationDeg: 0,
    density: 1
  },
  penrose: {
    tileScaleM: 1,
    projectionMethod: "radial",
    clippingBoundaryBehavior: "trim",
    triangulateForStructure: false
  },
  quads: {
    uDivisions: 18,
    vDivisions: 9,
    quadAspectPreference: "balanced",
    diagonalBracing: false
  },
  geodesic: {
    basePolyhedron: "icosahedron",
    frequency: 3,
    subdivisionMethod: "class-I",
    strutGroupingMode: "by-length",
    projectToSurface: true
  },
  lamella: {
    sectors: 24,
    horizontalRings: 8,
    lamellaAngleDeg: 45,
    spacingMode: "equal-height"
  },
  schwedlerRibbed: {
    meridionalRibs: 24,
    horizontalRings: 8,
    diagonalBracing: false,
    ribSpacingMode: "equal-height"
  },
  kiewitt: {
    radialRibs: 18,
    hoopRings: 8,
    subdivisionCount: 8,
    triangulationMode: "alternating"
  },
  threeWayGrid: {
    gridDensity: 1,
    targetEdgeLengthM: 0.85,
    triangulationOrientation: "alternating",
    ringAlignmentPreference: "balanced"
  },
  gridshell: {
    gridSpacingM: 1,
    principalDirectionBias: 0,
    curvatureAdaptationStiffness: 0.6,
    shellMode: "quad"
  },
  reciprocalFrame: {
    membersPerRing: 14,
    overlapLengthM: 0.2,
    memberDepthM: 0.12,
    rotationalOffsetDeg: 14,
    concentricTierCount: 4
  }
};

export const defaultNodeSettings: NodeSettings = {
  kind: "points",
  points: {
    pointSizeMm: 75,
    nodeStyle: "connector",
    showNodeMarkers: true
  },
  rings: {
    ringDiameterMm: 300,
    ringTubeDiameterMm: 30,
    orientationMode: "parallel-to-local-surface",
    showFullRingGeometry: true,
    rotationAboutNormalDeg: 0,
    eccentricOffsetMm: 0,
    weldStubLengthMm: 0,
    maxAttachments: null
  }
};

export const normalizeProjectState = (state: ProjectState): ProjectState => {
  const current = state as ProjectState & { surface?: SurfaceSettings; pattern?: PatternSettings; nodes?: NodeSettings };
  const surface = normalizeSurfaceSettings(current.surface ?? deriveSurfaceFromLegacy(current.geometry));
  const pattern = normalizePatternSettings(current.pattern ?? derivePatternFromLegacy(current));
  const nodes = normalizeNodeSettings(current.nodes ?? defaultNodeSettings);
  const legacy = deriveLegacyGeometryFromNew(surface, pattern);

  return {
    ...state,
    surface,
    pattern,
    nodes,
    geometry: {
      ...legacy.geometry,
      ...state.geometry,
      pattern: legacy.geometry.pattern,
      shape: legacy.geometry.shape,
      diameterM: legacy.geometry.diameterM,
      sphereCoverage: legacy.geometry.sphereCoverage,
      flatBase: legacy.geometry.flatBase,
      capHeightM: legacy.geometry.capHeightM,
      cutPlaneZ: legacy.geometry.cutPlaneZ,
      topCutPlaneZ: legacy.geometry.topCutPlaneZ,
      bottomCutPlaneZ: legacy.geometry.bottomCutPlaneZ,
      snapCoverageToNodeLayer: state.geometry.snapCoverageToNodeLayer ?? false,
      orientation: { ...legacy.geometry.orientation, ...state.geometry.orientation }
    },
    geodesic: { ...state.geodesic, ...legacy.geodesic },
    lamella: { ...state.lamella, ...legacy.lamella },
    ribbedRectangular: { ...state.ribbedRectangular, ...legacy.ribbedRectangular }
  };
};

export const surfaceKindLabel = (kind: SurfaceGeometryKind): string => {
  if (kind === "spherical") return "Spherical";
  if (kind === "ellipsoidal") return "Ellipsoidal";
  if (kind === "onion") return "Onion";
  if (kind === "catenary") return "Catenary";
  return "Paraboloid";
};

export const patternKindLabel = (kind: PatternKind): string => {
  if (kind === "hexagons-pentagons") return "Hexagons / pentagons";
  if (kind === "penrose") return "Penrose";
  if (kind === "schwedler-ribbed") return "Schwedler / ribbed";
  if (kind === "three-way-grid") return "Three-way grid";
  if (kind === "reciprocal-frame") return "Reciprocal frame dome";
  return kind
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const nodeTreatmentLabel = (kind: NodeSettings["kind"]): string => (kind === "points" ? "Point nodes" : "Ring nodes");

export const patternCategoryLabel = (kind: PatternKind): string => {
  if (kind === "penrose" || kind === "hexagons-pentagons" || kind === "diamonds") return "panelization";
  if (kind === "gridshell" || kind === "reciprocal-frame" || kind === "three-way-grid") return "hybrid";
  return "structural family";
};

export const surfacePrimaryDiameterM = (surface: SurfaceSettings): number => {
  if (surface.kind === "spherical") return surface.spherical.diameterM;
  if (surface.kind === "ellipsoidal") return Math.max(surface.ellipsoidal.xDiameterM, surface.ellipsoidal.yDiameterM);
  if (surface.kind === "onion") return Math.max(surface.onion.baseDiameterM, surface.onion.maxBulgeDiameterM);
  if (surface.kind === "catenary") return surface.catenary.spanDiameterM;
  return surface.paraboloid.baseDiameterM;
};

export const surfaceActiveHeightM = (surface: SurfaceSettings): number => {
  if (surface.kind === "spherical") return surface.spherical.domeHeightM;
  if (surface.kind === "ellipsoidal") return surface.ellipsoidal.truncationHeightM;
  if (surface.kind === "onion") return surface.onion.overallHeightM;
  if (surface.kind === "catenary") return surface.catenary.truncationHeightM;
  return surface.paraboloid.truncationHeightM;
};

export const nodeSummarySuffix = (state: ProjectState): string =>
  state.nodes.kind === "rings" ? `${Math.round(state.nodes.rings.ringDiameterMm)} mm diameter` : `${Math.round(state.nodes.points.pointSizeMm)} mm points`;

export const configurationSummaryLine = (state: ProjectState): string =>
  `${surfaceKindLabel(state.surface.kind)} surface + ${patternKindLabel(state.pattern.kind)} pattern + ${nodeTreatmentLabel(state.nodes.kind).toLowerCase()}, ${nodeSummarySuffix(state)}`;

export const patternDensityLabel = (state: ProjectState): string => {
  const { pattern } = state;
  if (pattern.kind === "geodesic") return `${pattern.geodesic.frequency}V`;
  if (pattern.kind === "lamella") return `${pattern.lamella.sectors} sectors / ${pattern.lamella.horizontalRings} rings`;
  if (pattern.kind === "schwedler-ribbed") return `${pattern.schwedlerRibbed.meridionalRibs} ribs / ${pattern.schwedlerRibbed.horizontalRings} rings`;
  if (pattern.kind === "kiewitt") return `${pattern.kiewitt.radialRibs} ribs / ${pattern.kiewitt.hoopRings} hoops`;
  if (pattern.kind === "quads") return `${pattern.quads.uDivisions} x ${pattern.quads.vDivisions}`;
  if (pattern.kind === "triangles") return `${pattern.triangles.frequency} subdivisions`;
  if (pattern.kind === "three-way-grid") return `${pattern.threeWayGrid.gridDensity.toFixed(1)} density`;
  if (pattern.kind === "gridshell") return `${pattern.gridshell.gridSpacingM.toFixed(2)} m spacing`;
  if (pattern.kind === "diamonds") return `${pattern.diamonds.density.toFixed(1)} density`;
  if (pattern.kind === "hexagons-pentagons") return `${pattern.hexagonsPentagons.targetCellSizeM.toFixed(2)} m cells`;
  if (pattern.kind === "penrose") return `${pattern.penrose.tileScaleM.toFixed(2)} m tiles`;
  return `${pattern.reciprocalFrame.membersPerRing} per ring`;
};

export const legacyPatternForKind = (kind: PatternKind): StructurePattern => {
  if (kind === "geodesic" || kind === "hexagons-pentagons") return "geodesic";
  if (kind === "lamella" || kind === "diamonds" || kind === "penrose") return "lamella";
  return "ribbed-rectangular";
};

const normalizeSurfaceSettings = (surface: SurfaceSettings): SurfaceSettings => {
  const sphericalDiameter = clampPositive(surface.spherical.diameterM, defaultSurfaceSettings.spherical.diameterM);
  const sphericalRadius = sphericalDiameter / 2;
  const sphericalHeight = clamp(surface.spherical.domeHeightM, 0.05, sphericalDiameter);
  const sphericalVerticalCut = sphericalRadius - sphericalHeight;
  const sphericalBaseDiameter = chordDiameterFromPlane(sphericalRadius, sphericalVerticalCut);
  const sphericalTopOpening = clamp(surface.spherical.topOpeningDiameterM, 0, sphericalDiameter - 0.001);

  const ellipsoidalHeight = clampPositive(surface.ellipsoidal.zHeightM, defaultSurfaceSettings.ellipsoidal.zHeightM);
  const ellipsoidalTruncation = clamp(surface.ellipsoidal.truncationHeightM, 0.05, ellipsoidalHeight);
  const ellipsoidalOpening = clamp(
    surface.ellipsoidal.topOpeningDiameterM,
    0,
    Math.min(surface.ellipsoidal.xDiameterM, surface.ellipsoidal.yDiameterM) - 0.001
  );

  const overallHeight = clampPositive(surface.onion.overallHeightM, defaultSurfaceSettings.onion.overallHeightM);
  const shoulderHeight = clamp(surface.onion.shoulderHeightM, 0.05, overallHeight - 0.05);
  const apexHeight = clamp(surface.onion.apexHeightM, shoulderHeight + 0.05, overallHeight - 0.01);

  const catenaryHeight = clampPositive(surface.catenary.heightM, defaultSurfaceSettings.catenary.heightM);
  const paraboloidHeight = clampPositive(surface.paraboloid.heightM, defaultSurfaceSettings.paraboloid.heightM);

  return {
    kind: surface.kind,
    spherical: {
      diameterM: sphericalDiameter,
      radiusM: sphericalRadius,
      domeHeightM: sphericalHeight,
      baseDiameterM: sphericalBaseDiameter,
      topOpeningDiameterM: sphericalTopOpening,
      verticalCutPositionM: sphericalVerticalCut
    },
    ellipsoidal: {
      xDiameterM: clampPositive(surface.ellipsoidal.xDiameterM, defaultSurfaceSettings.ellipsoidal.xDiameterM),
      yDiameterM: clampPositive(surface.ellipsoidal.yDiameterM, defaultSurfaceSettings.ellipsoidal.yDiameterM),
      zHeightM: ellipsoidalHeight,
      truncationHeightM: ellipsoidalTruncation,
      topOpeningDiameterM: ellipsoidalOpening
    },
    onion: {
      baseDiameterM: clampPositive(surface.onion.baseDiameterM, defaultSurfaceSettings.onion.baseDiameterM),
      shoulderHeightM: shoulderHeight,
      maxBulgeDiameterM: Math.max(
        clampPositive(surface.onion.maxBulgeDiameterM, defaultSurfaceSettings.onion.maxBulgeDiameterM),
        surface.onion.baseDiameterM,
        surface.onion.neckDiameterM
      ),
      neckDiameterM: clampPositive(surface.onion.neckDiameterM, defaultSurfaceSettings.onion.neckDiameterM),
      apexHeightM: apexHeight,
      overallHeightM: overallHeight,
      topOpeningDiameterM: clamp(surface.onion.topOpeningDiameterM, 0, surface.onion.neckDiameterM - 0.001)
    },
    catenary: {
      spanDiameterM: clampPositive(surface.catenary.spanDiameterM, defaultSurfaceSettings.catenary.spanDiameterM),
      heightM: catenaryHeight,
      shapeFactor: clamp(surface.catenary.shapeFactor, 0.2, 6),
      truncationHeightM: clamp(surface.catenary.truncationHeightM, 0.05, catenaryHeight),
      topOpeningDiameterM: clamp(surface.catenary.topOpeningDiameterM, 0, surface.catenary.spanDiameterM - 0.001)
    },
    paraboloid: {
      baseDiameterM: clampPositive(surface.paraboloid.baseDiameterM, defaultSurfaceSettings.paraboloid.baseDiameterM),
      heightM: paraboloidHeight,
      curvatureCoefficient: clamp(surface.paraboloid.curvatureCoefficient, 0.2, 4),
      truncationHeightM: clamp(surface.paraboloid.truncationHeightM, 0.05, paraboloidHeight),
      topOpeningDiameterM: clamp(surface.paraboloid.topOpeningDiameterM, 0, surface.paraboloid.baseDiameterM - 0.001)
    }
  };
};

const normalizePatternSettings = (pattern: PatternSettings): PatternSettings => ({
  kind: pattern.kind,
  triangles: {
    targetEdgeLengthM: clampPositive(pattern.triangles.targetEdgeLengthM, defaultPatternSettings.triangles.targetEdgeLengthM),
    frequency: clampInteger(pattern.triangles.frequency, 1, 24),
    equalEdgePreference: pattern.triangles.equalEdgePreference,
    triangulationMethod: pattern.triangles.triangulationMethod
  },
  hexagonsPentagons: {
    targetCellSizeM: clampPositive(
      pattern.hexagonsPentagons.targetCellSizeM,
      defaultPatternSettings.hexagonsPentagons.targetCellSizeM
    ),
    pentagonDistributionMode: pattern.hexagonsPentagons.pentagonDistributionMode,
    panelRegularityPreference: pattern.hexagonsPentagons.panelRegularityPreference,
    triangulateForStructure: pattern.hexagonsPentagons.triangulateForStructure
  },
  diamonds: {
    diamondWidthM: clampPositive(pattern.diamonds.diamondWidthM, defaultPatternSettings.diamonds.diamondWidthM),
    diamondHeightM: clampPositive(pattern.diamonds.diamondHeightM, defaultPatternSettings.diamonds.diamondHeightM),
    gridRotationDeg: pattern.diamonds.gridRotationDeg,
    density: clamp(pattern.diamonds.density, 0.25, 4)
  },
  penrose: {
    tileScaleM: clampPositive(pattern.penrose.tileScaleM, defaultPatternSettings.penrose.tileScaleM),
    projectionMethod: pattern.penrose.projectionMethod,
    clippingBoundaryBehavior: pattern.penrose.clippingBoundaryBehavior,
    triangulateForStructure: pattern.penrose.triangulateForStructure
  },
  quads: {
    uDivisions: clampInteger(pattern.quads.uDivisions, 3, 180),
    vDivisions: clampInteger(pattern.quads.vDivisions, 1, 120),
    quadAspectPreference: pattern.quads.quadAspectPreference,
    diagonalBracing: pattern.quads.diagonalBracing
  },
  geodesic: {
    basePolyhedron: pattern.geodesic.basePolyhedron,
    frequency: clampInteger(pattern.geodesic.frequency, 1, 8) as GeodesicSettings["frequency"],
    subdivisionMethod: pattern.geodesic.subdivisionMethod,
    strutGroupingMode: pattern.geodesic.strutGroupingMode,
    projectToSurface: pattern.geodesic.projectToSurface
  },
  lamella: {
    sectors: clampInteger(pattern.lamella.sectors, 3, 240),
    horizontalRings: clampInteger(pattern.lamella.horizontalRings, 1, 120),
    lamellaAngleDeg: clamp(pattern.lamella.lamellaAngleDeg, 5, 85),
    spacingMode: pattern.lamella.spacingMode
  },
  schwedlerRibbed: {
    meridionalRibs: clampInteger(pattern.schwedlerRibbed.meridionalRibs, 3, 240),
    horizontalRings: clampInteger(pattern.schwedlerRibbed.horizontalRings, 1, 120),
    diagonalBracing: pattern.schwedlerRibbed.diagonalBracing,
    ribSpacingMode: pattern.schwedlerRibbed.ribSpacingMode
  },
  kiewitt: {
    radialRibs: clampInteger(pattern.kiewitt.radialRibs, 3, 240),
    hoopRings: clampInteger(pattern.kiewitt.hoopRings, 1, 120),
    subdivisionCount: clampInteger(pattern.kiewitt.subdivisionCount, 1, 120),
    triangulationMode: pattern.kiewitt.triangulationMode
  },
  threeWayGrid: {
    gridDensity: clamp(pattern.threeWayGrid.gridDensity, 0.25, 4),
    targetEdgeLengthM: clampPositive(
      pattern.threeWayGrid.targetEdgeLengthM,
      defaultPatternSettings.threeWayGrid.targetEdgeLengthM
    ),
    triangulationOrientation: pattern.threeWayGrid.triangulationOrientation,
    ringAlignmentPreference: pattern.threeWayGrid.ringAlignmentPreference
  },
  gridshell: {
    gridSpacingM: clampPositive(pattern.gridshell.gridSpacingM, defaultPatternSettings.gridshell.gridSpacingM),
    principalDirectionBias: clamp(pattern.gridshell.principalDirectionBias, -1, 1),
    curvatureAdaptationStiffness: clamp(pattern.gridshell.curvatureAdaptationStiffness, 0, 1),
    shellMode: pattern.gridshell.shellMode
  },
  reciprocalFrame: {
    membersPerRing: clampInteger(pattern.reciprocalFrame.membersPerRing, 3, 240),
    overlapLengthM: clampPositive(pattern.reciprocalFrame.overlapLengthM, defaultPatternSettings.reciprocalFrame.overlapLengthM),
    memberDepthM: clampPositive(pattern.reciprocalFrame.memberDepthM, defaultPatternSettings.reciprocalFrame.memberDepthM),
    rotationalOffsetDeg: pattern.reciprocalFrame.rotationalOffsetDeg,
    concentricTierCount: clampInteger(pattern.reciprocalFrame.concentricTierCount, 1, 40)
  }
});

const normalizeNodeSettings = (nodes: NodeSettings): NodeSettings => ({
  kind: nodes.kind,
  points: {
    pointSizeMm: clamp(nodes.points.pointSizeMm, 5, 1000),
    nodeStyle: nodes.points.nodeStyle,
    showNodeMarkers: nodes.points.showNodeMarkers
  },
  rings: {
    ringDiameterMm: clamp(nodes.rings.ringDiameterMm, 20, 5000),
    ringTubeDiameterMm: clamp(nodes.rings.ringTubeDiameterMm, 4, 500),
    orientationMode: nodes.rings.orientationMode,
    showFullRingGeometry: nodes.rings.showFullRingGeometry,
    rotationAboutNormalDeg: nodes.rings.rotationAboutNormalDeg,
    eccentricOffsetMm: clamp(nodes.rings.eccentricOffsetMm, -2000, 2000),
    weldStubLengthMm: clamp(nodes.rings.weldStubLengthMm, 0, 2000),
    maxAttachments: nodes.rings.maxAttachments === null ? null : clampInteger(nodes.rings.maxAttachments, 1, 32)
  }
});

export const deriveSurfaceFromLegacy = (geometry: GeometrySettings): SurfaceSettings => {
  const radius = geometry.diameterM / 2;
  const baseZ =
    geometry.shape === "full-sphere"
      ? -radius
      : geometry.shape === "hemisphere"
        ? 0
        : geometry.shape === "spherical-cap" || geometry.shape === "flattened-base"
          ? geometry.cutPlaneZ ?? 0
          : geometry.bottomCutPlaneZ ?? geometry.cutPlaneZ ?? -radius;
  const topZ =
    geometry.shape === "sphere-segment" ? geometry.topCutPlaneZ ?? radius : geometry.shape === "hemisphere" ? radius : radius;
  const domeHeightM = Math.max(0.05, topZ - baseZ);

  return normalizeSurfaceSettings({
    ...defaultSurfaceSettings,
    kind: "spherical",
    spherical: {
      diameterM: geometry.diameterM,
      radiusM: radius,
      domeHeightM,
      baseDiameterM: chordDiameterFromPlane(radius, baseZ),
      topOpeningDiameterM: chordDiameterFromPlane(radius, topZ),
      verticalCutPositionM: baseZ
    }
  });
};

export const derivePatternFromLegacy = (state: ProjectState): PatternSettings => {
  if (state.geometry.pattern === "geodesic") {
    return normalizePatternSettings({
      ...defaultPatternSettings,
      kind: "geodesic",
      geodesic: {
        ...defaultPatternSettings.geodesic,
        basePolyhedron: state.geodesic.basePolyhedron === "icosahedron" ? "icosahedron" : "octahedron",
        frequency: state.geodesic.frequency,
        subdivisionMethod: state.geodesic.subdivisionClass === "class-I" ? "class-I" : "class-II"
      }
    });
  }

  if (state.geometry.pattern === "lamella") {
    return normalizePatternSettings({
      ...defaultPatternSettings,
      kind: "lamella",
      lamella: {
        ...defaultPatternSettings.lamella,
        sectors: state.lamella.sectors,
        horizontalRings: state.lamella.rings,
        lamellaAngleDeg: state.lamella.style === "curved" ? 55 : state.lamella.style === "alternating" ? 45 : 35,
        spacingMode: "equal-height"
      }
    });
  }

  return normalizePatternSettings({
    ...defaultPatternSettings,
    kind: "schwedler-ribbed",
    schwedlerRibbed: {
      ...defaultPatternSettings.schwedlerRibbed,
      meridionalRibs: state.ribbedRectangular.ribs,
      horizontalRings: state.ribbedRectangular.rings,
      diagonalBracing: state.ribbedRectangular.diagonalBracing !== "none"
    }
  });
};

const deriveLegacyGeometryFromNew = (
  surface: SurfaceSettings,
  pattern: PatternSettings
): {
  geometry: GeometrySettings;
  geodesic: GeodesicSettings;
  lamella: LamellaSettings;
  ribbedRectangular: RibbedRectangularSettings;
} => {
  const legacyPattern = legacyPatternForKind(pattern.kind);
  const geometry = createLegacyGeometry(surface, legacyPattern, pattern);
  return {
    geometry,
    geodesic: {
      frequency: pattern.geodesic.frequency,
      basePolyhedron: "icosahedron",
      subdivisionClass: pattern.geodesic.subdivisionMethod === "class-II" ? "class-I" : "class-I"
    },
    lamella: {
      sectors: pattern.lamella.sectors,
      rings: pattern.lamella.horizontalRings,
      style:
        pattern.lamella.spacingMode === "equal-angle"
          ? "parallel"
          : pattern.lamella.spacingMode === "equal-arc"
            ? "curved"
            : "alternating",
      handedness: pattern.lamella.lamellaAngleDeg >= 0 ? "right" : "left",
      hoopRings: true,
      crownRing: true,
      baseRing: true,
      triangulation: "alternating"
    },
    ribbedRectangular: {
      ribs: pattern.kind === "kiewitt" ? pattern.kiewitt.radialRibs : pattern.schwedlerRibbed.meridionalRibs,
      rings: pattern.kind === "kiewitt" ? pattern.kiewitt.hoopRings : pattern.schwedlerRibbed.horizontalRings,
      ribMode: "segmented-straight",
      ringMode: "segmented-straight",
      diagonalBracing:
        pattern.kind === "kiewitt"
          ? "alternating"
          : pattern.schwedlerRibbed.diagonalBracing
            ? "single"
            : "none"
    }
  };
};

const createLegacyGeometry = (
  surface: SurfaceSettings,
  patternKind: StructurePattern,
  pattern: PatternSettings
): GeometrySettings => {
  const base: GeometrySettings = {
    pattern: patternKind,
    shape: "spherical-cap",
    diameterM: surfacePrimaryDiameterM(surface),
    sphereCoverage: 0.5,
    snapCoverageToNodeLayer: false,
    flatBase: true,
    capHeightM: surfaceActiveHeightM(surface),
    cutPlaneZ: 0,
    topCutPlaneZ: undefined,
    bottomCutPlaneZ: undefined,
    orientation: {
      mode: "vertex-up",
      rotationEuler: [0, 0, 0]
    }
  };

  if (surface.kind !== "spherical") {
    return base;
  }

  const radius = surface.spherical.diameterM / 2;
  const baseZ = surface.spherical.verticalCutPositionM;
  const topZ = topPlaneFromOpening(radius, surface.spherical.topOpeningDiameterM);
  const domeHeight = topZ - baseZ;
  const coverage = clamp(domeHeight / surface.spherical.diameterM, 0.05, 1);
  const shape =
    surface.spherical.topOpeningDiameterM > 0
      ? "sphere-segment"
      : domeHeight >= surface.spherical.diameterM - 1e-6
        ? "full-sphere"
        : Math.abs(baseZ) < 1e-6
          ? "hemisphere"
          : baseZ > 0
            ? "spherical-cap"
            : "flattened-base";

  return {
    ...base,
    diameterM: surface.spherical.diameterM,
    shape,
    sphereCoverage: coverage,
    flatBase: shape === "flattened-base",
    capHeightM: domeHeight,
    cutPlaneZ: baseZ,
    topCutPlaneZ: topZ,
    bottomCutPlaneZ: baseZ
  };
};

const topPlaneFromOpening = (radius: number, openingDiameterM: number): number => {
  const openingRadius = clamp(openingDiameterM / 2, 0, radius);
  return Math.sqrt(Math.max(0, radius * radius - openingRadius * openingRadius));
};

const chordDiameterFromPlane = (radius: number, planeZ: number): number =>
  Math.sqrt(Math.max(0, radius * radius - planeZ * planeZ)) * 2;

const clampPositive = (value: number, fallback: number): number =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const clampInteger = (value: number, min: number, max: number): number =>
  Math.round(clamp(Number.isFinite(value) ? value : min, min, max));

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
