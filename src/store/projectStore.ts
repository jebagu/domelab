import { create } from "zustand";
import type { MaterialSettings, ProjectState, Selection, ShapeMode, StructurePattern, Units } from "../types";
import { defaultProject } from "../data/defaultProject";

const storageKey = "domelab-project-state";
const fileNameStorageKey = "domelab-project-file-name";
const newUnsavedFileName = "New unsaved";

interface ProjectStore {
  state: ProjectState;
  fileName: string;
  activeTab: "3D Model" | "Description" | "Cost Assumptions" | "BOM" | "Fabrication" | "Load, Save" | "Export";
  spin: boolean;
  selection: Selection;
  wizardOpen: boolean;
  setActiveTab: (tab: ProjectStore["activeTab"]) => void;
  setSelection: (selection: Selection) => void;
  clearSelection: () => void;
  toggleSpin: () => void;
  closeWizard: () => void;
  updateState: (updater: (state: ProjectState) => ProjectState) => void;
  setPattern: (pattern: StructurePattern) => void;
  setShape: (shape: ShapeMode) => void;
  setUnits: (units: Units) => void;
  loadProject: (state: ProjectState, fileName?: string) => void;
  saveLocal: () => void;
}

function loadInitialProject(): ProjectState {
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return defaultProject;
  try {
    return mergeProject(defaultProject, JSON.parse(stored) as Partial<ProjectState>);
  } catch {
    return defaultProject;
  }
}

function mergeProject(base: ProjectState, partial: Partial<ProjectState>): ProjectState {
  const incomingShape = partial.geometry?.shape ?? base.geometry.shape;
  const shape = isActiveShape(incomingShape) ? incomingShape : "full-sphere";
  const reference = partial.reference ?? base.reference;
  const material = mergeMaterial(base.material, partial.material);
  const mergedGeometry = {
    ...base.geometry,
    ...partial.geometry,
    shape,
    orientation: { ...base.geometry.orientation, ...partial.geometry?.orientation }
  };
  const geometry = {
    ...mergedGeometry,
    sphereCoverage: partial.geometry?.sphereCoverage ?? coverageFromGeometry(mergedGeometry),
    flatBase: partial.geometry?.flatBase ?? mergedGeometry.shape === "flattened-base"
  };
  return {
    ...base,
    ...partial,
    connectorSystem: partial.connectorSystem ?? base.connectorSystem,
    project: { ...base.project, ...partial.project },
    geometry,
    geodesic: { ...base.geodesic, ...partial.geodesic },
    lamella: { ...base.lamella, ...partial.lamella },
    ribbedRectangular: { ...base.ribbedRectangular, ...partial.ribbedRectangular },
    connectors: {
      flattenedBolted: { ...base.connectors.flattenedBolted, ...partial.connectors?.flattenedBolted },
      ballHub: { ...base.connectors.ballHub, ...partial.connectors?.ballHub },
      weldedNode: { ...base.connectors.weldedNode, ...partial.connectors?.weldedNode }
    },
    material,
    reference: reference
        ? {
          sourceLabel: reference.sourceLabel ?? "",
          note: reference.note ?? "",
          knownParameters: reference.knownParameters ?? [],
          unknownParameters: reference.unknownParameters ?? [],
          pricingSummary: reference.pricingSummary ?? [],
          parts: reference.parts ?? []
        }
      : undefined
  };
}

function coverageFromGeometry(geometry: ProjectState["geometry"]): number {
  const radius = geometry.diameterM / 2;
  if (geometry.shape === "full-sphere") return 1;
  if (geometry.shape === "hemisphere") return 0.5;
  if (geometry.shape === "spherical-cap" && geometry.capHeightM !== undefined) {
    return clamp(geometry.capHeightM / geometry.diameterM, 0.5, 1);
  }
  if (geometry.shape === "flattened-base" && geometry.cutPlaneZ !== undefined) {
    return clamp((radius - geometry.cutPlaneZ) / geometry.diameterM, 0.5, 1);
  }
  if (
    geometry.shape === "sphere-segment" &&
    geometry.topCutPlaneZ !== undefined &&
    geometry.bottomCutPlaneZ !== undefined
  ) {
    return clamp((geometry.topCutPlaneZ - geometry.bottomCutPlaneZ) / geometry.diameterM, 0.5, 1);
  }
  return 1;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function mergeMaterial(
  base: MaterialSettings,
  partial?: Partial<MaterialSettings> & { costMode?: "estimated" | "blank" }
): MaterialSettings {
  const { costMode, ...rest } = partial ?? {};
  const material = { ...base, ...rest };
  if (costMode !== "blank") return material;
  return {
    ...material,
    costPerMeter: null,
    stockLengthM: null,
    wasteFactor: null,
    endOperationCostPerEnd: null,
    nodeBaseCost: null,
    nodePerStrutAdder: null,
    setupCost: null,
    contingencyPercent: null
  };
}

function isActiveShape(shape: ShapeMode): shape is ShapeMode {
  return (
    shape === "full-sphere" ||
    shape === "hemisphere" ||
    shape === "spherical-cap" ||
    shape === "flattened-base" ||
    shape === "sphere-segment"
  );
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  state: loadInitialProject(),
  fileName: window.localStorage.getItem(fileNameStorageKey) || newUnsavedFileName,
  activeTab: "3D Model",
  spin: false,
  selection: { type: "none" },
  wizardOpen: !window.localStorage.getItem("domelab-wizard-complete"),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: { type: "none" } }),
  toggleSpin: () => set((store) => ({ spin: !store.spin })),
  closeWizard: () => {
    window.localStorage.setItem("domelab-wizard-complete", "true");
    set({ wizardOpen: false });
  },
  updateState: (updater) => set((store) => ({ state: updater(store.state), selection: { type: "none" } })),
  setPattern: (pattern) =>
    get().updateState((state) => ({ ...state, geometry: { ...state.geometry, pattern } })),
  setShape: (shape) => get().updateState((state) => ({ ...state, geometry: { ...state.geometry, shape } })),
  setUnits: (units) => get().updateState((state) => ({ ...state, project: { ...state.project, units } })),
  loadProject: (projectState, fileName = newUnsavedFileName) =>
    set({ state: mergeProject(defaultProject, projectState), fileName, selection: { type: "none" } }),
  saveLocal: () => {
    window.localStorage.setItem(storageKey, JSON.stringify(get().state));
    window.localStorage.setItem(fileNameStorageKey, get().fileName);
  }
}));
