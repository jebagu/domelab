export type StructurePattern = "geodesic" | "lamella" | "ribbed-rectangular";

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
