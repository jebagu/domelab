export type StructurePattern = "geodesic" | "lamella" | "ribbed-rectangular";

export type SurfaceGeometryKind = "spherical" | "ellipsoidal" | "onion" | "catenary" | "paraboloid";

export type PatternKind =
  | "triangles"
  | "hexagons-pentagons"
  | "diamonds"
  | "penrose"
  | "quads"
  | "geodesic"
  | "lamella"
  | "schwedler-ribbed"
  | "kiewitt"
  | "three-way-grid"
  | "gridshell"
  | "reciprocal-frame";

export type NodeTreatmentKind = "points" | "rings";

export type ShapeMode =
  | "full-sphere"
  | "hemisphere"
  | "spherical-cap"
  | "flattened-base"
  | "sphere-segment";

export type ConnectorSystem =
  | "flattened-drilled-bolted"
  | "ball-hub"
  | "welded-node";

export type Units = "metric" | "imperial";

export interface ProjectSettings {
  units: Units;
  currency: string;
  precisionMm: number;
  lengthGroupToleranceMm: number;
}

export interface SphericalSurfaceSettings {
  diameterM: number;
  radiusM: number;
  domeHeightM: number;
  baseDiameterM: number;
  topOpeningDiameterM: number;
  verticalCutPositionM: number;
}

export interface EllipsoidalSurfaceSettings {
  xDiameterM: number;
  yDiameterM: number;
  zHeightM: number;
  truncationHeightM: number;
  topOpeningDiameterM: number;
}

export interface OnionSurfaceSettings {
  baseDiameterM: number;
  shoulderHeightM: number;
  maxBulgeDiameterM: number;
  neckDiameterM: number;
  apexHeightM: number;
  overallHeightM: number;
  topOpeningDiameterM: number;
}

export interface CatenarySurfaceSettings {
  spanDiameterM: number;
  heightM: number;
  shapeFactor: number;
  truncationHeightM: number;
  topOpeningDiameterM: number;
}

export interface ParaboloidSurfaceSettings {
  baseDiameterM: number;
  heightM: number;
  curvatureCoefficient: number;
  truncationHeightM: number;
  topOpeningDiameterM: number;
}

export interface SurfaceSettings {
  kind: SurfaceGeometryKind;
  spherical: SphericalSurfaceSettings;
  ellipsoidal: EllipsoidalSurfaceSettings;
  onion: OnionSurfaceSettings;
  catenary: CatenarySurfaceSettings;
  paraboloid: ParaboloidSurfaceSettings;
}

export interface TrianglesPatternSettings {
  targetEdgeLengthM: number;
  frequency: number;
  equalEdgePreference: boolean;
  triangulationMethod: "alternating" | "bias-left" | "bias-right" | "radial";
}

export interface HexPentPatternSettings {
  targetCellSizeM: number;
  pentagonDistributionMode: "icosahedral" | "crown-biased" | "uniform";
  panelRegularityPreference: "regular" | "surface-following";
  triangulateForStructure: boolean;
}

export interface DiamondsPatternSettings {
  diamondWidthM: number;
  diamondHeightM: number;
  gridRotationDeg: number;
  density: number;
}

export interface PenrosePatternSettings {
  tileScaleM: number;
  projectionMethod: "radial" | "vertical" | "normal";
  clippingBoundaryBehavior: "trim" | "preserve-partials";
  triangulateForStructure: boolean;
}

export interface QuadsPatternSettings {
  uDivisions: number;
  vDivisions: number;
  quadAspectPreference: "balanced" | "vertical" | "horizontal";
  diagonalBracing: boolean;
}

export interface GeodesicPatternSettings {
  basePolyhedron: "icosahedron" | "octahedron";
  frequency: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  subdivisionMethod: "class-I" | "class-II";
  strutGroupingMode: "by-length" | "by-band";
  projectToSurface: boolean;
}

export interface LamellaPatternSettings {
  sectors: number;
  horizontalRings: number;
  lamellaAngleDeg: number;
  spacingMode: "equal-angle" | "equal-height" | "equal-arc";
}

export interface SchwedlerPatternSettings {
  meridionalRibs: number;
  horizontalRings: number;
  diagonalBracing: boolean;
  ribSpacingMode: "equal-angle" | "equal-height" | "equal-arc";
}

export interface KiewittPatternSettings {
  radialRibs: number;
  hoopRings: number;
  subdivisionCount: number;
  triangulationMode: "fan" | "alternating" | "radial";
}

export interface ThreeWayGridPatternSettings {
  gridDensity: number;
  targetEdgeLengthM: number;
  triangulationOrientation: "alternating" | "clockwise" | "counterclockwise";
  ringAlignmentPreference: "balanced" | "aligned";
}

export interface GridshellPatternSettings {
  gridSpacingM: number;
  principalDirectionBias: number;
  curvatureAdaptationStiffness: number;
  shellMode: "quad" | "triangulated";
}

export interface ReciprocalFramePatternSettings {
  membersPerRing: number;
  overlapLengthM: number;
  memberDepthM: number;
  rotationalOffsetDeg: number;
  concentricTierCount: number;
}

export interface PatternSettings {
  kind: PatternKind;
  triangles: TrianglesPatternSettings;
  hexagonsPentagons: HexPentPatternSettings;
  diamonds: DiamondsPatternSettings;
  penrose: PenrosePatternSettings;
  quads: QuadsPatternSettings;
  geodesic: GeodesicPatternSettings;
  lamella: LamellaPatternSettings;
  schwedlerRibbed: SchwedlerPatternSettings;
  kiewitt: KiewittPatternSettings;
  threeWayGrid: ThreeWayGridPatternSettings;
  gridshell: GridshellPatternSettings;
  reciprocalFrame: ReciprocalFramePatternSettings;
}

export interface PointNodeSettings {
  pointSizeMm: number;
  nodeStyle: "simple" | "connector" | "emphasis";
  showNodeMarkers: boolean;
}

export interface RingNodeSettings {
  ringDiameterMm: number;
  ringTubeDiameterMm: number;
  orientationMode: "parallel-to-local-surface" | "horizontal";
  showFullRingGeometry: boolean;
  rotationAboutNormalDeg: number;
  eccentricOffsetMm: number;
  weldStubLengthMm: number;
  maxAttachments: number | null;
}

export interface NodeSettings {
  kind: NodeTreatmentKind;
  points: PointNodeSettings;
  rings: RingNodeSettings;
}

export interface GeometrySettings {
  pattern: StructurePattern;
  shape: ShapeMode;
  diameterM: number;
  sphereCoverage?: number;
  snapCoverageToNodeLayer?: boolean;
  flatBase?: boolean;
  capHeightM?: number;
  cutPlaneZ?: number;
  topCutPlaneZ?: number;
  bottomCutPlaneZ?: number;
  orientation: {
    mode: "vertex-up" | "face-up" | "edge-up" | "custom";
    rotationEuler: [number, number, number];
  };
}

export interface GeodesicSettings {
  frequency: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  basePolyhedron: "icosahedron";
  subdivisionClass: "class-I";
}

export interface LamellaSettings {
  sectors: number;
  rings: number;
  style: "parallel" | "curved" | "alternating";
  handedness: "left" | "right" | "alternating";
  hoopRings: boolean;
  crownRing: boolean;
  baseRing: boolean;
  triangulation: "none" | "single" | "alternating" | "x-brace";
}

export interface RibbedRectangularSettings {
  ribs: number;
  rings: number;
  ribMode: "segmented-straight" | "bent";
  ringMode: "segmented-straight" | "bent";
  diagonalBracing: "none" | "single" | "alternating" | "x-brace";
}

export interface MaterialSettings {
  materialName: string;
  profileType: "round tube" | "square tube" | "pipe" | "flat bar" | "custom";
  profileLabel: string;
  strutDiameterMm: number;
  costPerMeter: number | null;
  stockLengthM: number | null;
  wasteFactor: number | null;
  endOperationCostPerEnd: number | null;
  nodeBaseCost: number | null;
  nodePerStrutAdder: number | null;
  setupCost: number | null;
  contingencyPercent: number | null;
}

export interface ConnectorSettings {
  flattenedBolted: {
    holeDiameterMm: number;
    holeOffsetMm: number;
    flattenLengthMm: number;
    flattenCompensationMm: number;
    boltCost: number;
    nutCost: number;
    washerCost: number;
  };
  ballHub: {
    socketSeatOffsetMm: number;
    trimAllowanceMm: number;
    ballDiameterMm: number;
    socketAdapterCost: number;
    maxValence: number;
  };
  weldedNode: {
    weldSetbackMm: number;
    copeAllowanceMm: number;
    bevelDeg: number;
    nodeShellCost: number;
    weldCostPerEnd: number;
  };
}

export interface ReferencePartGroup {
  id: string;
  description: string;
  quantity: number;
  spares?: number;
  totalQuantity?: number;
  cutLengthM: number;
  fabricationLengthM?: number;
  endAngleADeg?: number;
  endAngleBDeg?: number;
  bendAngleDeg?: number;
  color?: string;
  tubeType?: string;
  unitPriceUsd?: number;
  lineTotalUsd?: number;
}

export interface ProjectReference {
  sourceLabel: string;
  note: string;
  knownParameters?: string[];
  unknownParameters?: string[];
  pricingSummary?: string[];
  parts: ReferencePartGroup[];
}

export interface ProjectState {
  project: ProjectSettings;
  surface: SurfaceSettings;
  pattern: PatternSettings;
  nodes: NodeSettings;
  geometry: GeometrySettings;
  geodesic: GeodesicSettings;
  lamella: LamellaSettings;
  ribbedRectangular: RibbedRectangularSettings;
  connectorSystem: ConnectorSystem;
  connectors: ConnectorSettings;
  material: MaterialSettings;
  reference?: ProjectReference;
}

export type NodeRole = "interior" | "base" | "crown" | "boundary" | "cut";

export interface Node {
  id: string;
  position: [number, number, number];
  role: NodeRole;
  incidentEdgeIds: string[];
  valence: number;
  surfaceNormal?: [number, number, number];
  tangentX?: [number, number, number];
  tangentY?: [number, number, number];
  ring?: {
    center: [number, number, number];
    diameterM: number;
    tubeDiameterM: number;
    normal: [number, number, number];
    tangentX: [number, number, number];
    tangentY: [number, number, number];
  };
}

export type EdgeRole =
  | "interior"
  | "base-ring"
  | "crown-ring"
  | "boundary"
  | "diagonal"
  | "rib"
  | "hoop";

export interface EndCondition {
  type: "flat-drilled" | "socket" | "welded-cope" | "plain-cut";
  holeDiameterMm?: number;
  holeOffsetMm?: number;
  socketSeatOffsetMm?: number;
  copeAngleDeg?: number;
  bevelDeg?: number;
}

export interface Edge {
  id: string;
  nodeA: string;
  nodeB: string;
  role: EdgeRole;
  modelLengthM: number;
  fabricationLengthM: number;
  cutLengthM: number;
  renderStart?: [number, number, number];
  renderEnd?: [number, number, number];
  materialProfileId: string;
  connectorSystem: ConnectorSystem;
  endConditionA: EndCondition;
  endConditionB: EndCondition;
}

export interface Face {
  id: string;
  nodeIds: [string, string, string];
}

export interface GeometryResult {
  nodes: Node[];
  edges: Edge[];
  faces: Face[];
  warnings: ValidationMessage[];
}

export interface StrutGroup {
  id: string;
  label: string;
  quantity: number;
  modelLengthM: number;
  fabricationLengthM: number;
  cutLengthM: number;
  edgeIds: string[];
  materialProfileId: string;
  connectorSystem: ConnectorSystem;
  estimatedCost: number | null;
  role: EdgeRole;
  endTreatment: string;
}

export interface NodeGroup {
  id: string;
  label: string;
  quantity: number;
  valence: number;
  role: NodeRole;
  connectorSystem: ConnectorSystem;
  nodeIds: string[];
  estimatedCost: number | null;
  fabricationNote: string;
}

export interface OperationCounts {
  cuts: number;
  flattenedEnds: number;
  drilledHoles: number;
  tappedHoles: number;
  weldEnds: number;
  copedEnds: number;
  bolts: number;
  nuts: number;
  washers: number;
  sockets: number;
  inserts: number;
  clamps: number;
}

export interface StockPlan {
  stockLengthM: number | null;
  barCount: number | null;
  usedLengthM: number | null;
  scrapLengthM: number | null;
  reusableOffcutsM: number[];
  yieldPercent: number | null;
}

export interface CostBreakdown {
  material: number | null;
  endOperations: number | null;
  nodeConnectors: number | null;
  hardware: number | null;
  welding: number | null;
  finishing: number | null;
  waste: number | null;
  setup: number | null;
  contingency: number | null;
  total: number | null;
}

export interface BomResult {
  strutGroups: StrutGroup[];
  nodeGroups: NodeGroup[];
  operationCounts: OperationCounts;
  stockPlan: StockPlan;
  costs: CostBreakdown;
  totalStrutLengthM: number;
  totalCutLengthM: number;
  warnings: ValidationMessage[];
}

export interface BuiltProject {
  geometry: GeometryResult;
  bom: BomResult;
}

export interface ValidationMessage {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
}

export type Selection =
  | { type: "none" }
  | { type: "edge"; id: string; groupId?: string }
  | { type: "node"; id: string; groupId?: string }
  | { type: "strut-group"; id: string }
  | { type: "node-group"; id: string };

export type DisplayMode =
  | "clean"
  | "strut-groups"
  | "node-valence"
  | "cost-heatmap"
  | "fabrication"
  | "clipping";
