import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { buildProject } from "./buildProject";
import { defaultProject } from "./data/defaultProject";
import { cloneProjectState, projectPresets } from "./data/presets";
import { createBomCsv, downloadBlob, downloadTextFile } from "./export/csv";
import { createProjectJson, parseProjectJson } from "./export/jsonProject";
import {
  createQuoteDocxWithViews,
  defaultQuoteViewOptions,
  type QuoteProjectionMode,
  type QuoteViewName,
  type QuoteViewOption
} from "./export/quoteDocx";
import { configurationSummaryLine, nodeTreatmentLabel, normalizeProjectState as normalizeProjectConfiguration, patternCategoryLabel, patternDensityLabel, patternKindLabel, surfaceKindLabel, surfacePrimaryDiameterM } from "./configuration";
import type { BuiltProject, NodeSettings, PatternKind, ProjectState, Selection, SurfaceGeometryKind } from "./types";
import { clearDebugLogs, debugLog, formatDebugLogEntries, getDebugLogEntries, measureAsync, subscribeDebugLogs } from "./utils/debug";
import { currency, metersToDisplay, number, percent } from "./utils/format";
import {
  DomeScene,
  type DomeSceneHandle,
  type ViewCameraMode,
  type ViewProjectionMode,
  type ViewRenderStyle
} from "./viewport/DomeScene";

const tabs = ["3D Model", "Description", "Cost Assumptions", "BOM", "Fabrication", "Load, Save", "Export", "Debug"] as const;
type Tab = (typeof tabs)[number];

export const App = () => {
  const [state, setState] = useState<ProjectState>(defaultProject);
  const [activeTab, setActiveTab] = useState<Tab>("3D Model");
  const [selection, setSelection] = useState<Selection>({ type: "none" });
  const [spin, setSpin] = useState(false);
  const [cameraView, setCameraView] = useState<ViewCameraMode>("isometric");
  const [projectionMode, setProjectionMode] = useState<ViewProjectionMode>("perspective");
  const [renderStyle, setRenderStyle] = useState<ViewRenderStyle>("color");
  const [fogDensity, setFogDensity] = useState(38);
  const [frontHemisphereOnly, setFrontHemisphereOnly] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const [isExportingViewportPng, setIsExportingViewportPng] = useState(false);
  const [fileName, setFileName] = useState("New unsaved");
  const sceneRef = useRef<DomeSceneHandle>(null);
  const built = useMemo(() => buildProject(state), [state]);
  const warnings = [...built.geometry.warnings, ...built.bom.warnings];

  useEffect(() => {
    debugLog("app", "tab-change", { tab: activeTab });
  }, [activeTab]);

  const updateState = (updater: (current: ProjectState) => ProjectState) => {
    setState((current) => normalizeProjectConfiguration(updater(current)));
    setSelection({ type: "none" });
  };

  const loadProject = (nextState: ProjectState, nextFileName: string) => {
    debugLog("app", "load-project", {
      fileName: nextFileName,
      surface: nextState.surface.kind,
      pattern: nextState.pattern.kind,
      diameterM: Number(surfacePrimaryDiameterM(nextState.surface).toFixed(3))
    });
    setState(normalizeProjectConfiguration(nextState));
    setFileName(nextFileName);
    setSelection({ type: "none" });
  };

  return (
    <main className="app-shell">
      <TopBar built={built} state={state} fileName={fileName} warningCount={warnings.length} onTab={setActiveTab} />
      <section className="workbench">
        <aside className="panel left-panel">
          <DesignControls state={state} warnings={warnings} updateState={updateState} />
        </aside>
        <section className="panel workspace-panel">
          <TabBar activeTab={activeTab} onTab={setActiveTab} />
          {activeTab === "3D Model" && (
            <section className="viewport-wrap workspace-view">
              <ViewportToolbar
                spin={spin}
                toggleSpin={() => setSpin((value) => !value)}
                cameraView={cameraView}
                setCameraView={setCameraView}
                projectionMode={projectionMode}
                setProjectionMode={setProjectionMode}
                renderStyle={renderStyle}
                setRenderStyle={setRenderStyle}
                fogDensity={fogDensity}
                setFogDensity={setFogDensity}
                frontHemisphereOnly={frontHemisphereOnly}
                setFrontHemisphereOnly={setFrontHemisphereOnly}
                isExportingPng={isExportingViewportPng}
                onExportPng={async () => {
                  setIsExportingViewportPng(true);
                  try {
                    const blob = await measureAsync(
                      "app",
                      "export-viewport-png",
                      async () => sceneRef.current?.exportPng() ?? null,
                      {
                        cameraView,
                        projectionMode,
                        renderStyle,
                        frontHemisphereOnly
                      }
                    );
                    if (blob) {
                      downloadBlob(`domelab-${cameraView}-${projectionMode}.png`, blob);
                    }
                  } finally {
                    setIsExportingViewportPng(false);
                  }
                }}
                onReset={() => setResetVersion((value) => value + 1)}
              />
              <DomeScene
                ref={sceneRef}
                built={built}
                displayMode="clean"
                selection={selection}
                spin={spin}
                strutDiameterMm={state.material.strutDiameterMm}
                nodeSettings={state.nodes}
                cameraView={cameraView}
                projectionMode={projectionMode}
                renderStyle={renderStyle}
                fogDensity={fogDensity}
                frontHemisphereOnly={frontHemisphereOnly}
                resetVersion={resetVersion}
                onSelect={setSelection}
              />
              <SelectionInspector built={built} state={state} selection={selection} />
            </section>
          )}
          {activeTab === "Description" && <DescriptionPanel state={state} updateState={updateState} />}
          {activeTab === "Cost Assumptions" && <CostPanel built={built} state={state} updateState={updateState} />}
          {activeTab === "BOM" && <BomPanel built={built} state={state} setSelection={setSelection} />}
          {activeTab === "Fabrication" && <FabricationPanel built={built} state={state} />}
          {activeTab === "Load, Save" && <LoadSavePanel state={state} loadProject={loadProject} setFileName={setFileName} />}
          {activeTab === "Export" && <ExportPanel built={built} state={state} />}
          {activeTab === "Debug" && <DebugPanel />}
        </section>
      </section>
    </main>
  );
};

const TopBar = ({
  built,
  state,
  fileName,
  warningCount,
  onTab
}: {
  built: BuiltProject;
  state: ProjectState;
  fileName: string;
  warningCount: number;
  onTab: (tab: Tab) => void;
}) => (
  <header className="top-bar">
    <div className="brand-lockup">
      <div className="brand-mark">DL</div>
      <div>
        <h1>Dome Lab</h1>
        <p>Experimental dome geometry and fabrication lab</p>
      </div>
    </div>
    <Metric label="File" value={fileName} />
    <Metric label="Diameter" value={metersToDisplay(surfacePrimaryDiameterM(state.surface), state.project.units)} onClick={() => onTab("3D Model")} />
    <Metric
      label="Equator above ground"
      value={metersToDisplay(equatorHeightAboveGround(state), state.project.units)}
      onClick={() => onTab("3D Model")}
    />
    <Metric label="Surface" value={surfaceKindLabel(state.surface.kind)} onClick={() => onTab("3D Model")} />
    <Metric label="Pattern" value={patternKindLabel(state.pattern.kind)} onClick={() => onTab("3D Model")} />
    <Metric label="Node type" value={nodeTreatmentLabel(state.nodes.kind)} onClick={() => onTab("3D Model")} />
    <Metric label="Density" value={patternDensityLabel(state)} onClick={() => onTab("3D Model")} />
    <Metric label="Node count" value={number(built.geometry.nodes.length)} onClick={() => onTab("BOM")} />
    <Metric label="Struts" value={number(built.geometry.edges.length)} onClick={() => onTab("BOM")} />
    <Metric label="Length Groups" value={number(built.bom.strutGroups.length)} onClick={() => onTab("BOM")} />
    <Metric label="Cost estimate" value={costDisplay(built.bom.costs.total, state)} onClick={() => onTab("Cost Assumptions")} tone="cost" />
    <Metric label="Warnings" value={number(warningCount)} onClick={() => onTab("BOM")} tone={warningCount ? "warn" : undefined} />
  </header>
);

const Metric = ({
  label,
  value,
  tone,
  onClick
}: {
  label: string;
  value: string;
  tone?: "cost" | "warn";
  onClick?: () => void;
}) => {
  const className = `metric-chip ${tone ?? ""}`;
  if (!onClick) {
    return (
      <div className={className} title={value}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    );
  }
  return (
    <button className={className} title={value} onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
};

const DesignControls = ({
  state,
  warnings,
  updateState
}: {
  state: ProjectState;
  warnings: BuiltProject["bom"]["warnings"];
  updateState: (updater: (state: ProjectState) => ProjectState) => void;
}) => {
  const [activeConfigTab, setActiveConfigTab] = useState<"surface" | "pattern" | "nodes">("surface");

  return (
    <div className="panel-scroll">
      <SectionTitle title="Design Controls" kicker="parametric dome configurator" />
      <div className="selection-inspector">
        <strong>{configurationSummaryLine(state)}</strong>
        <span>{surfaceKindLabel(state.surface.kind)} surface, {patternCategoryLabel(state.pattern.kind)} pattern, {nodeTreatmentLabel(state.nodes.kind).toLowerCase()}.</span>
      </div>
      <div className="control-grid two">
        <NumericInput
          label="Strut diameter (mm)"
          value={state.material.strutDiameterMm}
          min={1}
          step={1}
          onChange={(value) =>
            updateState((current) => ({ ...current, material: { ...current.material, strutDiameterMm: value } }))
          }
        />
        <NumericInput
          label="Length tolerance (mm)"
          value={state.project.lengthGroupToleranceMm}
          min={0.1}
          step={0.1}
          onChange={(value) =>
            updateState((current) => ({ ...current, project: { ...current.project, lengthGroupToleranceMm: value } }))
          }
        />
      </div>
      <Segmented
        value={activeConfigTab}
        options={[
          ["surface", "Surface geometry"],
          ["pattern", "Pattern"],
          ["nodes", "Nodes"]
        ]}
        onChange={(value) => setActiveConfigTab(value as "surface" | "pattern" | "nodes")}
      />
      {activeConfigTab === "surface" && <SurfaceGeometryControls state={state} updateState={updateState} />}
      {activeConfigTab === "pattern" && <PatternControls state={state} updateState={updateState} />}
      {activeConfigTab === "nodes" && <NodeControls state={state} updateState={updateState} />}
      <Warnings warnings={warnings} />
    </div>
  );
};

const SurfaceGeometryControls = ({
  state,
  updateState
}: {
  state: ProjectState;
  updateState: (updater: (state: ProjectState) => ProjectState) => void;
}) => (
  <>
    <p className="disclaimer">Define the underlying dome surface first. Patterning and node logic are applied after this geometry is established.</p>
    <SelectInput
      label="Surface geometry"
      value={state.surface.kind}
      options={[
        ["spherical", "Spherical"],
        ["ellipsoidal", "Ellipsoidal"],
        ["onion", "Onion"],
        ["catenary", "Catenary"],
        ["paraboloid", "Paraboloid"]
      ]}
      onChange={(value) =>
        updateState((current) => ({
          ...current,
          surface: { ...current.surface, kind: value as SurfaceGeometryKind }
        }))
      }
    />
    {state.surface.kind === "spherical" && (
      <div className="control-grid two">
        <NumericInput
          label="Diameter (m)"
          value={state.surface.spherical.diameterM}
          min={0.1}
          step={0.1}
          onChange={(value) =>
            updateState((current) => ({
              ...current,
              surface: {
                ...current.surface,
                spherical: { ...current.surface.spherical, diameterM: value, radiusM: value / 2 }
              }
            }))
          }
        />
        <NumericInput
          label="Radius (m)"
          value={state.surface.spherical.radiusM}
          min={0.05}
          step={0.05}
          onChange={(value) =>
            updateState((current) => ({
              ...current,
              surface: {
                ...current.surface,
                spherical: { ...current.surface.spherical, diameterM: value * 2, radiusM: value }
              }
            }))
          }
        />
        <NumericInput
          label="Dome height (m)"
          value={state.surface.spherical.domeHeightM}
          min={0.05}
          step={0.05}
          onChange={(value) =>
            updateState((current) => ({
              ...current,
              surface: {
                ...current.surface,
                spherical: { ...current.surface.spherical, domeHeightM: value }
              }
            }))
          }
        />
        <NumericInput
          label="Base diameter (m)"
          value={state.surface.spherical.baseDiameterM}
          min={0}
          step={0.05}
          onChange={(value) =>
            updateState((current) => ({
              ...current,
              surface: {
                ...current.surface,
                spherical: {
                  ...current.surface.spherical,
                  domeHeightM: sphericalHeightFromBaseDiameter(
                    current.surface.spherical.diameterM,
                    value,
                    current.surface.spherical.domeHeightM
                  )
                }
              }
            }))
          }
        />
        <NumericInput
          label="Top opening diameter (m)"
          value={state.surface.spherical.topOpeningDiameterM}
          min={0}
          step={0.05}
          onChange={(value) =>
            updateState((current) => ({
              ...current,
              surface: {
                ...current.surface,
                spherical: { ...current.surface.spherical, topOpeningDiameterM: value }
              }
            }))
          }
        />
        <NumericInput
          label="Vertical cut position (m)"
          value={state.surface.spherical.verticalCutPositionM}
          min={-state.surface.spherical.radiusM}
          max={state.surface.spherical.radiusM}
          step={0.05}
          onChange={(value) =>
            updateState((current) => ({
              ...current,
              surface: {
                ...current.surface,
                spherical: {
                  ...current.surface.spherical,
                  domeHeightM: sphericalHeightFromVerticalCut(current.surface.spherical.diameterM, value)
                }
              }
            }))
          }
        />
      </div>
    )}
    {state.surface.kind === "spherical" && state.pattern.kind === "geodesic" && (
      <>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={state.geometry.snapCoverageToNodeLayer ?? false}
            onChange={(event) =>
              updateState((current) => ({
                ...current,
                geometry: { ...current.geometry, snapCoverageToNodeLayer: event.target.checked }
              }))
            }
          />
          <span>Snap spherical cuts to clean geodesic node layers</span>
        </label>
        <p className="toggle-note">Useful when a cut plane lands close to an existing geodesic node band and creates near-overlapping boundary nodes.</p>
      </>
    )}
    {state.surface.kind === "ellipsoidal" && (
      <div className="control-grid two">
        <NumericInput label="X diameter (m)" value={state.surface.ellipsoidal.xDiameterM} min={0.1} step={0.1} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, ellipsoidal: { ...current.surface.ellipsoidal, xDiameterM: value } } }))} />
        <NumericInput label="Y diameter (m)" value={state.surface.ellipsoidal.yDiameterM} min={0.1} step={0.1} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, ellipsoidal: { ...current.surface.ellipsoidal, yDiameterM: value } } }))} />
        <NumericInput label="Z height (m)" value={state.surface.ellipsoidal.zHeightM} min={0.1} step={0.1} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, ellipsoidal: { ...current.surface.ellipsoidal, zHeightM: value } } }))} />
        <NumericInput label="Vertical truncation height (m)" value={state.surface.ellipsoidal.truncationHeightM} min={0.05} step={0.05} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, ellipsoidal: { ...current.surface.ellipsoidal, truncationHeightM: value } } }))} />
        <NumericInput label="Top opening diameter (m)" value={state.surface.ellipsoidal.topOpeningDiameterM} min={0} step={0.05} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, ellipsoidal: { ...current.surface.ellipsoidal, topOpeningDiameterM: value } } }))} />
      </div>
    )}
    {state.surface.kind === "onion" && (
      <div className="control-grid two">
        <NumericInput label="Base diameter (m)" value={state.surface.onion.baseDiameterM} min={0.1} step={0.1} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, onion: { ...current.surface.onion, baseDiameterM: value } } }))} />
        <NumericInput label="Shoulder height (m)" value={state.surface.onion.shoulderHeightM} min={0.05} step={0.05} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, onion: { ...current.surface.onion, shoulderHeightM: value } } }))} />
        <NumericInput label="Max bulge diameter (m)" value={state.surface.onion.maxBulgeDiameterM} min={0.1} step={0.1} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, onion: { ...current.surface.onion, maxBulgeDiameterM: value } } }))} />
        <NumericInput label="Neck diameter (m)" value={state.surface.onion.neckDiameterM} min={0.05} step={0.05} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, onion: { ...current.surface.onion, neckDiameterM: value } } }))} />
        <NumericInput label="Apex height (m)" value={state.surface.onion.apexHeightM} min={0.05} step={0.05} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, onion: { ...current.surface.onion, apexHeightM: value } } }))} />
        <NumericInput label="Overall height (m)" value={state.surface.onion.overallHeightM} min={0.1} step={0.1} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, onion: { ...current.surface.onion, overallHeightM: value } } }))} />
        <NumericInput label="Top opening diameter (m)" value={state.surface.onion.topOpeningDiameterM} min={0} step={0.05} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, onion: { ...current.surface.onion, topOpeningDiameterM: value } } }))} />
      </div>
    )}
    {state.surface.kind === "catenary" && (
      <div className="control-grid two">
        <NumericInput label="Span / base diameter (m)" value={state.surface.catenary.spanDiameterM} min={0.1} step={0.1} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, catenary: { ...current.surface.catenary, spanDiameterM: value } } }))} />
        <NumericInput label="Height (m)" value={state.surface.catenary.heightM} min={0.1} step={0.1} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, catenary: { ...current.surface.catenary, heightM: value } } }))} />
        <NumericInput label="Shape factor" value={state.surface.catenary.shapeFactor} min={0.2} max={6} step={0.1} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, catenary: { ...current.surface.catenary, shapeFactor: value } } }))} />
        <NumericInput label="Truncation height (m)" value={state.surface.catenary.truncationHeightM} min={0.05} step={0.05} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, catenary: { ...current.surface.catenary, truncationHeightM: value } } }))} />
        <NumericInput label="Top opening diameter (m)" value={state.surface.catenary.topOpeningDiameterM} min={0} step={0.05} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, catenary: { ...current.surface.catenary, topOpeningDiameterM: value } } }))} />
      </div>
    )}
    {state.surface.kind === "paraboloid" && (
      <div className="control-grid two">
        <NumericInput label="Base diameter (m)" value={state.surface.paraboloid.baseDiameterM} min={0.1} step={0.1} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, paraboloid: { ...current.surface.paraboloid, baseDiameterM: value } } }))} />
        <NumericInput label="Height (m)" value={state.surface.paraboloid.heightM} min={0.1} step={0.1} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, paraboloid: { ...current.surface.paraboloid, heightM: value } } }))} />
        <NumericInput label="Curvature coefficient" value={state.surface.paraboloid.curvatureCoefficient} min={0.2} max={4} step={0.1} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, paraboloid: { ...current.surface.paraboloid, curvatureCoefficient: value } } }))} />
        <NumericInput label="Truncation height (m)" value={state.surface.paraboloid.truncationHeightM} min={0.05} step={0.05} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, paraboloid: { ...current.surface.paraboloid, truncationHeightM: value } } }))} />
        <NumericInput label="Top opening diameter (m)" value={state.surface.paraboloid.topOpeningDiameterM} min={0} step={0.05} onChange={(value) => updateState((current) => ({ ...current, surface: { ...current.surface, paraboloid: { ...current.surface.paraboloid, topOpeningDiameterM: value } } }))} />
      </div>
    )}
  </>
);

const PatternControls = ({
  state,
  updateState
}: {
  state: ProjectState;
  updateState: (updater: (state: ProjectState) => ProjectState) => void;
}) => (
  <>
    <p className="disclaimer">Choose the panelization pattern, structural family, or hybrid logic applied to the selected surface. Not all triangulated domes are geodesic.</p>
    <SelectInput
      label="Pattern / structural family"
      value={state.pattern.kind}
      options={[
        ["triangles", "Triangles"],
        ["hexagons-pentagons", "Hexagons / pentagons"],
        ["diamonds", "Diamonds"],
        ["penrose", "Penrose"],
        ["quads", "Quads"],
        ["geodesic", "Geodesic"],
        ["lamella", "Lamella"],
        ["schwedler-ribbed", "Schwedler / ribbed"],
        ["kiewitt", "Kiewitt"],
        ["three-way-grid", "Three-way grid / reticulated dome"],
        ["gridshell", "Gridshell"],
        ["reciprocal-frame", "Reciprocal frame dome"]
      ]}
      onChange={(value) =>
        updateState((current) => ({
          ...current,
          pattern: { ...current.pattern, kind: value as PatternKind }
        }))
      }
    />
    <p className="toggle-note">Current category: {patternCategoryLabel(state.pattern.kind)}.</p>
    {state.pattern.kind === "triangles" && (
      <div className="control-grid two">
        <NumericInput label="Target edge length (m)" value={state.pattern.triangles.targetEdgeLengthM} min={0.1} step={0.05} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, triangles: { ...current.pattern.triangles, targetEdgeLengthM: value } } }))} />
        <NumericInput label="Frequency / subdivision" value={state.pattern.triangles.frequency} min={1} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, triangles: { ...current.pattern.triangles, frequency: Math.round(value) } } }))} />
        <label className="toggle-row"><input type="checkbox" checked={state.pattern.triangles.equalEdgePreference} onChange={(event) => updateState((current) => ({ ...current, pattern: { ...current.pattern, triangles: { ...current.pattern.triangles, equalEdgePreference: event.target.checked } } }))} /><span>Prefer equal edges</span></label>
        <SelectInput label="Triangulation method" value={state.pattern.triangles.triangulationMethod} options={[["alternating", "Alternating"], ["bias-left", "Bias left"], ["bias-right", "Bias right"], ["radial", "Radial"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, triangles: { ...current.pattern.triangles, triangulationMethod: value as ProjectState["pattern"]["triangles"]["triangulationMethod"] } } }))} />
      </div>
    )}
    {state.pattern.kind === "hexagons-pentagons" && (
      <div className="control-grid two">
        <NumericInput label="Target cell size (m)" value={state.pattern.hexagonsPentagons.targetCellSizeM} min={0.1} step={0.05} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, hexagonsPentagons: { ...current.pattern.hexagonsPentagons, targetCellSizeM: value } } }))} />
        <SelectInput label="Pentagon distribution" value={state.pattern.hexagonsPentagons.pentagonDistributionMode} options={[["icosahedral", "Icosahedral"], ["crown-biased", "Crown biased"], ["uniform", "Uniform"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, hexagonsPentagons: { ...current.pattern.hexagonsPentagons, pentagonDistributionMode: value as ProjectState["pattern"]["hexagonsPentagons"]["pentagonDistributionMode"] } } }))} />
        <SelectInput label="Panel regularity" value={state.pattern.hexagonsPentagons.panelRegularityPreference} options={[["regular", "Regular"], ["surface-following", "Surface following"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, hexagonsPentagons: { ...current.pattern.hexagonsPentagons, panelRegularityPreference: value as ProjectState["pattern"]["hexagonsPentagons"]["panelRegularityPreference"] } } }))} />
        <label className="toggle-row"><input type="checkbox" checked={state.pattern.hexagonsPentagons.triangulateForStructure} onChange={(event) => updateState((current) => ({ ...current, pattern: { ...current.pattern, hexagonsPentagons: { ...current.pattern.hexagonsPentagons, triangulateForStructure: event.target.checked } } }))} /><span>Triangulate for structure</span></label>
      </div>
    )}
    {state.pattern.kind === "diamonds" && (
      <div className="control-grid two">
        <NumericInput label="Diamond width (m)" value={state.pattern.diamonds.diamondWidthM} min={0.1} step={0.05} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, diamonds: { ...current.pattern.diamonds, diamondWidthM: value } } }))} />
        <NumericInput label="Diamond height (m)" value={state.pattern.diamonds.diamondHeightM} min={0.1} step={0.05} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, diamonds: { ...current.pattern.diamonds, diamondHeightM: value } } }))} />
        <NumericInput label="Grid rotation angle (deg)" value={state.pattern.diamonds.gridRotationDeg} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, diamonds: { ...current.pattern.diamonds, gridRotationDeg: value } } }))} />
        <NumericInput label="Density" value={state.pattern.diamonds.density} min={0.25} max={4} step={0.05} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, diamonds: { ...current.pattern.diamonds, density: value } } }))} />
      </div>
    )}
    {state.pattern.kind === "penrose" && (
      <div className="control-grid two">
        <NumericInput label="Tile scale (m)" value={state.pattern.penrose.tileScaleM} min={0.1} step={0.05} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, penrose: { ...current.pattern.penrose, tileScaleM: value } } }))} />
        <SelectInput label="Projection method" value={state.pattern.penrose.projectionMethod} options={[["radial", "Radial"], ["vertical", "Vertical"], ["normal", "Normal"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, penrose: { ...current.pattern.penrose, projectionMethod: value as ProjectState["pattern"]["penrose"]["projectionMethod"] } } }))} />
        <SelectInput label="Clipping boundary" value={state.pattern.penrose.clippingBoundaryBehavior} options={[["trim", "Trim"], ["preserve-partials", "Preserve partials"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, penrose: { ...current.pattern.penrose, clippingBoundaryBehavior: value as ProjectState["pattern"]["penrose"]["clippingBoundaryBehavior"] } } }))} />
        <label className="toggle-row"><input type="checkbox" checked={state.pattern.penrose.triangulateForStructure} onChange={(event) => updateState((current) => ({ ...current, pattern: { ...current.pattern, penrose: { ...current.pattern.penrose, triangulateForStructure: event.target.checked } } }))} /><span>Triangulate for structure</span></label>
      </div>
    )}
    {state.pattern.kind === "quads" && (
      <div className="control-grid two">
        <NumericInput label="U divisions" value={state.pattern.quads.uDivisions} min={3} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, quads: { ...current.pattern.quads, uDivisions: Math.round(value) } } }))} />
        <NumericInput label="V divisions" value={state.pattern.quads.vDivisions} min={1} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, quads: { ...current.pattern.quads, vDivisions: Math.round(value) } } }))} />
        <SelectInput label="Quad aspect preference" value={state.pattern.quads.quadAspectPreference} options={[["balanced", "Balanced"], ["vertical", "Vertical"], ["horizontal", "Horizontal"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, quads: { ...current.pattern.quads, quadAspectPreference: value as ProjectState["pattern"]["quads"]["quadAspectPreference"] } } }))} />
        <label className="toggle-row"><input type="checkbox" checked={state.pattern.quads.diagonalBracing} onChange={(event) => updateState((current) => ({ ...current, pattern: { ...current.pattern, quads: { ...current.pattern.quads, diagonalBracing: event.target.checked } } }))} /><span>Diagonal bracing</span></label>
      </div>
    )}
    {state.pattern.kind === "geodesic" && (
      <div className="control-grid two">
        <SelectInput label="Base polyhedron" value={state.pattern.geodesic.basePolyhedron} options={[["icosahedron", "Icosahedron"], ["octahedron", "Octahedron"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, geodesic: { ...current.pattern.geodesic, basePolyhedron: value as ProjectState["pattern"]["geodesic"]["basePolyhedron"] } } }))} />
        <NumericInput label="Frequency" value={state.pattern.geodesic.frequency} min={1} max={8} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, geodesic: { ...current.pattern.geodesic, frequency: Math.round(value) as ProjectState["pattern"]["geodesic"]["frequency"] } } }))} />
        <SelectInput label="Class / subdivision method" value={state.pattern.geodesic.subdivisionMethod} options={[["class-I", "Class I"], ["class-II", "Class II"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, geodesic: { ...current.pattern.geodesic, subdivisionMethod: value as ProjectState["pattern"]["geodesic"]["subdivisionMethod"] } } }))} />
        <SelectInput label="Strut grouping mode" value={state.pattern.geodesic.strutGroupingMode} options={[["by-length", "By length"], ["by-band", "By band"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, geodesic: { ...current.pattern.geodesic, strutGroupingMode: value as ProjectState["pattern"]["geodesic"]["strutGroupingMode"] } } }))} />
        <label className="toggle-row"><input type="checkbox" checked={state.pattern.geodesic.projectToSurface} onChange={(event) => updateState((current) => ({ ...current, pattern: { ...current.pattern, geodesic: { ...current.pattern.geodesic, projectToSurface: event.target.checked } } }))} /><span>Project to surface</span></label>
      </div>
    )}
    {state.pattern.kind === "lamella" && (
      <div className="control-grid two">
        <NumericInput label="Number of sectors" value={state.pattern.lamella.sectors} min={3} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, lamella: { ...current.pattern.lamella, sectors: Math.round(value) } } }))} />
        <NumericInput label="Horizontal rings" value={state.pattern.lamella.horizontalRings} min={1} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, lamella: { ...current.pattern.lamella, horizontalRings: Math.round(value) } } }))} />
        <NumericInput label="Lamella angle / skew (deg)" value={state.pattern.lamella.lamellaAngleDeg} min={5} max={85} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, lamella: { ...current.pattern.lamella, lamellaAngleDeg: value } } }))} />
        <SelectInput label="Spacing mode" value={state.pattern.lamella.spacingMode} options={[["equal-angle", "Equal angle"], ["equal-height", "Equal height"], ["equal-arc", "Equal arc"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, lamella: { ...current.pattern.lamella, spacingMode: value as ProjectState["pattern"]["lamella"]["spacingMode"] } } }))} />
      </div>
    )}
    {state.pattern.kind === "schwedler-ribbed" && (
      <div className="control-grid two">
        <NumericInput label="Meridional ribs" value={state.pattern.schwedlerRibbed.meridionalRibs} min={3} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, schwedlerRibbed: { ...current.pattern.schwedlerRibbed, meridionalRibs: Math.round(value) } } }))} />
        <NumericInput label="Horizontal rings" value={state.pattern.schwedlerRibbed.horizontalRings} min={1} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, schwedlerRibbed: { ...current.pattern.schwedlerRibbed, horizontalRings: Math.round(value) } } }))} />
        <label className="toggle-row"><input type="checkbox" checked={state.pattern.schwedlerRibbed.diagonalBracing} onChange={(event) => updateState((current) => ({ ...current, pattern: { ...current.pattern, schwedlerRibbed: { ...current.pattern.schwedlerRibbed, diagonalBracing: event.target.checked } } }))} /><span>Diagonal bracing</span></label>
        <SelectInput label="Rib spacing mode" value={state.pattern.schwedlerRibbed.ribSpacingMode} options={[["equal-angle", "Equal angle"], ["equal-height", "Equal height"], ["equal-arc", "Equal arc"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, schwedlerRibbed: { ...current.pattern.schwedlerRibbed, ribSpacingMode: value as ProjectState["pattern"]["schwedlerRibbed"]["ribSpacingMode"] } } }))} />
      </div>
    )}
    {state.pattern.kind === "kiewitt" && (
      <div className="control-grid two">
        <NumericInput label="Radial ribs" value={state.pattern.kiewitt.radialRibs} min={3} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, kiewitt: { ...current.pattern.kiewitt, radialRibs: Math.round(value) } } }))} />
        <NumericInput label="Hoop rings" value={state.pattern.kiewitt.hoopRings} min={1} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, kiewitt: { ...current.pattern.kiewitt, hoopRings: Math.round(value) } } }))} />
        <NumericInput label="Subdivision count" value={state.pattern.kiewitt.subdivisionCount} min={1} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, kiewitt: { ...current.pattern.kiewitt, subdivisionCount: Math.round(value) } } }))} />
        <SelectInput label="Triangulation mode" value={state.pattern.kiewitt.triangulationMode} options={[["fan", "Fan"], ["alternating", "Alternating"], ["radial", "Radial"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, kiewitt: { ...current.pattern.kiewitt, triangulationMode: value as ProjectState["pattern"]["kiewitt"]["triangulationMode"] } } }))} />
      </div>
    )}
    {state.pattern.kind === "three-way-grid" && (
      <div className="control-grid two">
        <NumericInput label="Grid density" value={state.pattern.threeWayGrid.gridDensity} min={0.25} max={4} step={0.05} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, threeWayGrid: { ...current.pattern.threeWayGrid, gridDensity: value } } }))} />
        <NumericInput label="Target edge length (m)" value={state.pattern.threeWayGrid.targetEdgeLengthM} min={0.1} step={0.05} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, threeWayGrid: { ...current.pattern.threeWayGrid, targetEdgeLengthM: value } } }))} />
        <SelectInput label="Triangulation orientation" value={state.pattern.threeWayGrid.triangulationOrientation} options={[["alternating", "Alternating"], ["clockwise", "Clockwise"], ["counterclockwise", "Counterclockwise"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, threeWayGrid: { ...current.pattern.threeWayGrid, triangulationOrientation: value as ProjectState["pattern"]["threeWayGrid"]["triangulationOrientation"] } } }))} />
        <SelectInput label="Ring alignment preference" value={state.pattern.threeWayGrid.ringAlignmentPreference} options={[["balanced", "Balanced"], ["aligned", "Aligned"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, threeWayGrid: { ...current.pattern.threeWayGrid, ringAlignmentPreference: value as ProjectState["pattern"]["threeWayGrid"]["ringAlignmentPreference"] } } }))} />
      </div>
    )}
    {state.pattern.kind === "gridshell" && (
      <div className="control-grid two">
        <NumericInput label="Grid spacing (m)" value={state.pattern.gridshell.gridSpacingM} min={0.1} step={0.05} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, gridshell: { ...current.pattern.gridshell, gridSpacingM: value } } }))} />
        <NumericInput label="Principal direction bias" value={state.pattern.gridshell.principalDirectionBias} min={-1} max={1} step={0.05} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, gridshell: { ...current.pattern.gridshell, principalDirectionBias: value } } }))} />
        <NumericInput label="Curvature adaptation stiffness" value={state.pattern.gridshell.curvatureAdaptationStiffness} min={0} max={1} step={0.05} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, gridshell: { ...current.pattern.gridshell, curvatureAdaptationStiffness: value } } }))} />
        <SelectInput label="Shell mode" value={state.pattern.gridshell.shellMode} options={[["quad", "Quad"], ["triangulated", "Triangulated"]]} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, gridshell: { ...current.pattern.gridshell, shellMode: value as ProjectState["pattern"]["gridshell"]["shellMode"] } } }))} />
      </div>
    )}
    {state.pattern.kind === "reciprocal-frame" && (
      <div className="control-grid two">
        <NumericInput label="Members per ring" value={state.pattern.reciprocalFrame.membersPerRing} min={3} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, reciprocalFrame: { ...current.pattern.reciprocalFrame, membersPerRing: Math.round(value) } } }))} />
        <NumericInput label="Overlap length (m)" value={state.pattern.reciprocalFrame.overlapLengthM} min={0.01} step={0.01} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, reciprocalFrame: { ...current.pattern.reciprocalFrame, overlapLengthM: value } } }))} />
        <NumericInput label="Member depth (m)" value={state.pattern.reciprocalFrame.memberDepthM} min={0.01} step={0.01} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, reciprocalFrame: { ...current.pattern.reciprocalFrame, memberDepthM: value } } }))} />
        <NumericInput label="Rotational offset (deg)" value={state.pattern.reciprocalFrame.rotationalOffsetDeg} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, reciprocalFrame: { ...current.pattern.reciprocalFrame, rotationalOffsetDeg: value } } }))} />
        <NumericInput label="Concentric tier count" value={state.pattern.reciprocalFrame.concentricTierCount} min={1} step={1} onChange={(value) => updateState((current) => ({ ...current, pattern: { ...current.pattern, reciprocalFrame: { ...current.pattern.reciprocalFrame, concentricTierCount: Math.round(value) } } }))} />
      </div>
    )}
  </>
);

const NodeControls = ({
  state,
  updateState
}: {
  state: ProjectState;
  updateState: (updater: (state: ProjectState) => ProjectState) => void;
}) => (
  <>
    <p className="disclaimer">Node treatment defines what happens at each network intersection. Ring nodes stay parallel to the local surface tangent plane by default.</p>
    <SelectInput
      label="Node treatment"
      value={state.nodes.kind}
      options={[
        ["points", "Points"],
        ["rings", "Rings"]
      ]}
      onChange={(value) =>
        updateState((current) => ({
          ...current,
          nodes: { ...current.nodes, kind: value as NodeSettings["kind"] }
        }))
      }
    />
    {state.nodes.kind === "points" && (
      <div className="control-grid two">
        <NumericInput label="Point size (mm)" value={state.nodes.points.pointSizeMm} min={5} step={1} onChange={(value) => updateState((current) => ({ ...current, nodes: { ...current.nodes, points: { ...current.nodes.points, pointSizeMm: value } } }))} />
        <SelectInput label="Node style" value={state.nodes.points.nodeStyle} options={[["simple", "Simple"], ["connector", "Connector"], ["emphasis", "Emphasis"]]} onChange={(value) => updateState((current) => ({ ...current, nodes: { ...current.nodes, points: { ...current.nodes.points, nodeStyle: value as ProjectState["nodes"]["points"]["nodeStyle"] } } }))} />
        <label className="toggle-row"><input type="checkbox" checked={state.nodes.points.showNodeMarkers} onChange={(event) => updateState((current) => ({ ...current, nodes: { ...current.nodes, points: { ...current.nodes.points, showNodeMarkers: event.target.checked } } }))} /><span>Show node markers</span></label>
      </div>
    )}
    {state.nodes.kind === "rings" && (
      <div className="control-grid two">
        <NumericInput label="Ring diameter (mm)" value={state.nodes.rings.ringDiameterMm} min={20} step={5} onChange={(value) => updateState((current) => ({ ...current, nodes: { ...current.nodes, rings: { ...current.nodes.rings, ringDiameterMm: value } } }))} />
        <NumericInput label="Ring tube diameter (mm)" value={state.nodes.rings.ringTubeDiameterMm} min={4} step={1} onChange={(value) => updateState((current) => ({ ...current, nodes: { ...current.nodes, rings: { ...current.nodes.rings, ringTubeDiameterMm: value } } }))} />
        <SelectInput label="Ring orientation mode" value={state.nodes.rings.orientationMode} options={[["parallel-to-local-surface", "Parallel to local surface"], ["horizontal", "Horizontal"]]} onChange={(value) => updateState((current) => ({ ...current, nodes: { ...current.nodes, rings: { ...current.nodes.rings, orientationMode: value as ProjectState["nodes"]["rings"]["orientationMode"] } } }))} />
        <label className="toggle-row"><input type="checkbox" checked={state.nodes.rings.showFullRingGeometry} onChange={(event) => updateState((current) => ({ ...current, nodes: { ...current.nodes, rings: { ...current.nodes.rings, showFullRingGeometry: event.target.checked } } }))} /><span>Show full ring geometry</span></label>
        <NumericInput label="Ring rotation about normal (deg)" value={state.nodes.rings.rotationAboutNormalDeg} step={1} onChange={(value) => updateState((current) => ({ ...current, nodes: { ...current.nodes, rings: { ...current.nodes.rings, rotationAboutNormalDeg: value } } }))} />
        <NumericInput label="Eccentric offset (mm)" value={state.nodes.rings.eccentricOffsetMm} step={1} onChange={(value) => updateState((current) => ({ ...current, nodes: { ...current.nodes, rings: { ...current.nodes.rings, eccentricOffsetMm: value } } }))} />
        <NumericInput label="Weld / connector stub length (mm)" value={state.nodes.rings.weldStubLengthMm} min={0} step={1} onChange={(value) => updateState((current) => ({ ...current, nodes: { ...current.nodes, rings: { ...current.nodes.rings, weldStubLengthMm: value } } }))} />
        <NullableNumericInput label="Allowed strut attachments" value={state.nodes.rings.maxAttachments} onChange={(value) => updateState((current) => ({ ...current, nodes: { ...current.nodes, rings: { ...current.nodes.rings, maxAttachments: value === null ? null : Math.round(value) } } }))} />
      </div>
    )}
  </>
);

const ViewportToolbar = ({
  spin,
  toggleSpin,
  cameraView,
  setCameraView,
  projectionMode,
  setProjectionMode,
  renderStyle,
  setRenderStyle,
  fogDensity,
  setFogDensity,
  frontHemisphereOnly,
  setFrontHemisphereOnly,
  isExportingPng,
  onExportPng,
  onReset
}: {
  spin: boolean;
  toggleSpin: () => void;
  cameraView: ViewCameraMode;
  setCameraView: (view: ViewCameraMode) => void;
  projectionMode: ViewProjectionMode;
  setProjectionMode: (mode: ViewProjectionMode) => void;
  renderStyle: ViewRenderStyle;
  setRenderStyle: (style: ViewRenderStyle) => void;
  fogDensity: number;
  setFogDensity: (value: number) => void;
  frontHemisphereOnly: boolean;
  setFrontHemisphereOnly: (value: boolean) => void;
  isExportingPng: boolean;
  onExportPng: () => Promise<void>;
  onReset: () => void;
}) => (
  <div className="viewport-toolbar">
    <div className="toolbar-actions three-up">
      <button className={`tool-button ${cameraView === "plan" ? "active" : ""}`} onClick={() => setCameraView("plan")}>
        Plan
      </button>
      <button
        className={`tool-button ${cameraView === "elevation" ? "active" : ""}`}
        onClick={() => setCameraView("elevation")}
      >
        Elevation
      </button>
      <button
        className={`tool-button ${cameraView === "isometric" ? "active" : ""}`}
        onClick={() => setCameraView("isometric")}
      >
        Isometric
      </button>
    </div>
    <div className="toolbar-actions three-up">
      <button className="tool-button" onClick={onReset}>Reset</button>
      <button className={`tool-button ${spin ? "active" : ""}`} onClick={toggleSpin}>Spin</button>
      <button className="tool-button" onClick={() => void onExportPng()} disabled={isExportingPng}>
        {isExportingPng ? "PNG..." : "Export PNG"}
      </button>
    </div>
    <div className="toolbar-section">
      <span>Projection</span>
      <Segmented
        value={projectionMode}
        options={[
          ["perspective", "Perspective"],
          ["axonometric", "Axonometric"]
        ]}
        onChange={(value) => setProjectionMode(value as ViewProjectionMode)}
      />
    </div>
    <div className="toolbar-section">
      <span>Display</span>
      <Segmented
        value={renderStyle}
        options={[
          ["color", "Green"],
          ["pink-lines", "Pink"],
          ["plain-lines", "B&W"]
        ]}
        onChange={(value) => setRenderStyle(value as ViewRenderStyle)}
      />
    </div>
    <label className="toggle-row toolbar-toggle">
      <input
        type="checkbox"
        checked={frontHemisphereOnly}
        onChange={(event) => setFrontHemisphereOnly(event.target.checked)}
      />
      <span>Front hemisphere only</span>
    </label>
    <label className="toolbar-slider">
      <span>Fog density</span>
      <div className="toolbar-slider-row">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={fogDensity}
          onChange={(event) => setFogDensity(Number(event.target.value))}
        />
        <strong>{number(fogDensity)}</strong>
      </div>
    </label>
  </div>
);

const TabBar = ({ activeTab, onTab }: { activeTab: Tab; onTab: (tab: Tab) => void }) => (
  <nav className="tab-bar">
    {tabs.map((tab) => (
      <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => onTab(tab)}>
        {tab}
      </button>
    ))}
  </nav>
);

const DescriptionPanel = ({
  state,
  updateState
}: {
  state: ProjectState;
  updateState: (updater: (state: ProjectState) => ProjectState) => void;
}) => (
  <div className="panel-scroll">
    <TextAreaInput
      label="Description"
      value={state.reference?.note ?? ""}
      onChange={(value) =>
        updateState((current) => ({
          ...current,
          reference: {
            sourceLabel: current.reference?.sourceLabel ?? "",
            note: value,
            knownParameters: current.reference?.knownParameters ?? [],
            unknownParameters: current.reference?.unknownParameters ?? [],
            parts: current.reference?.parts ?? []
          }
        }))
      }
    />
  </div>
);

const CostPanel = ({
  built,
  state,
  updateState
}: {
  built: BuiltProject;
  state: ProjectState;
  updateState: (updater: (state: ProjectState) => ProjectState) => void;
}) => (
  <div className="panel-scroll">
    <SectionTitle title="Cost Assumptions" kicker="editable estimate basis" />
    <div className="assumption-grid">
      <TextInput label="Material" value={state.material.materialName} onChange={(value) => updateState((current) => ({ ...current, material: { ...current.material, materialName: value } }))} />
      <TextInput label="Profile" value={state.material.profileLabel} onChange={(value) => updateState((current) => ({ ...current, material: { ...current.material, profileLabel: value } }))} />
      <NullableNumericInput label="Cost per meter" value={state.material.costPerMeter} onChange={(value) => updateMaterial(updateState, "costPerMeter", value)} />
      <NullableNumericInput label="Stock length (m)" value={state.material.stockLengthM} onChange={(value) => updateMaterial(updateState, "stockLengthM", value)} />
      <NullableNumericInput label="Waste factor" value={state.material.wasteFactor} onChange={(value) => updateMaterial(updateState, "wasteFactor", value)} />
      <NullableNumericInput label="End operation cost" value={state.material.endOperationCostPerEnd} onChange={(value) => updateMaterial(updateState, "endOperationCostPerEnd", value)} />
      <NullableNumericInput label="Node base cost" value={state.material.nodeBaseCost} onChange={(value) => updateMaterial(updateState, "nodeBaseCost", value)} />
      <NullableNumericInput label="Node per-strut adder" value={state.material.nodePerStrutAdder} onChange={(value) => updateMaterial(updateState, "nodePerStrutAdder", value)} />
      <NullableNumericInput label="Setup cost" value={state.material.setupCost} onChange={(value) => updateMaterial(updateState, "setupCost", value)} />
      <NullableNumericInput label="Contingency (%)" value={state.material.contingencyPercent} onChange={(value) => updateMaterial(updateState, "contingencyPercent", value)} />
    </div>
    <SectionTitle title="Live Cost Breakdown" />
    <SummaryGrid
      items={[
        ["Strut material", costDisplay(built.bom.costs.material, state)],
        ["Connector/node material", costDisplay(built.bom.costs.nodeConnectors, state)],
        ["Hardware", costDisplay(built.bom.costs.hardware, state)],
        ["End operations", costDisplay(built.bom.costs.endOperations, state)],
        ["Waste", costDisplay(built.bom.costs.waste, state)],
        ["Total", costDisplay(built.bom.costs.total, state)]
      ]}
    />
  </div>
);

const BomPanel = ({
  built,
  state,
  setSelection
}: {
  built: BuiltProject;
  state: ProjectState;
  setSelection: (selection: Selection) => void;
}) => (
  <div className="panel-scroll">
    <SummaryGrid
      items={[
        ["Total cost", costDisplay(built.bom.costs.total, state)],
        ["Struts", number(built.geometry.edges.length)],
        ["Nodes", number(built.geometry.nodes.length)],
        ["Total nominal length", metersToDisplay(built.bom.totalStrutLengthM, state.project.units)],
        ["Length groups", number(built.bom.strutGroups.length)],
        [
          "Average strut",
          metersToDisplay(
            built.geometry.edges.length === 0 ? null : built.bom.totalStrutLengthM / built.geometry.edges.length,
            state.project.units
          )
        ]
      ]}
    />
    <SectionTitle title="Strut Groups" kicker="quote-friendly nominal length schedule" />
    <div className="bom-list">
      {built.bom.strutGroups.map((group) => (
        <button key={group.id} className="bom-row" onClick={() => setSelection({ type: "strut-group", id: group.id })}>
          <strong>{group.label}</strong>
          <span>Qty {group.quantity}</span>
          <span>Nominal strut length {metersToDisplay(group.modelLengthM, state.project.units)}</span>
          <span>Total nominal length {metersToDisplay(group.modelLengthM * group.quantity, state.project.units)}</span>
          <span>{group.role}</span>
          <span>{costDisplay(group.estimatedCost, state)}</span>
        </button>
      ))}
    </div>
    <SectionTitle title="Node Groups" />
    <div className="bom-list">
      {built.bom.nodeGroups.map((group) => (
        <button key={group.id} className="bom-row node-row" onClick={() => setSelection({ type: "node-group", id: group.id })}>
          <strong>{group.label}</strong>
          <span>Qty {group.quantity}</span>
          <span>Valence {group.valence}</span>
          <span>{group.role}</span>
          <span>{costDisplay(group.estimatedCost, state)}</span>
        </button>
      ))}
    </div>
  </div>
);

const FabricationPanel = ({ built, state }: { built: BuiltProject; state: ProjectState }) => (
  <div className="panel-scroll">
    <SectionTitle title="Fabrication Notes" />
    <div className="bom-list">
      {built.bom.strutGroups.map((group) => (
        <div key={group.id} className="shop-row">
          <strong>Group {group.label}</strong>
          <span>Qty {group.quantity}</span>
          <span>Model: {metersToDisplay(group.modelLengthM, state.project.units)}</span>
          <span>Reference: {metersToDisplay(group.fabricationLengthM, state.project.units)}</span>
          <span>Cut: {metersToDisplay(group.cutLengthM, state.project.units)}</span>
          <span>{group.endTreatment}</span>
        </div>
      ))}
    </div>
  </div>
);

const LoadSavePanel = ({
  state,
  loadProject,
  setFileName
}: {
  state: ProjectState;
  loadProject: (state: ProjectState, fileName: string) => void;
  setFileName: (fileName: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedPresetId, setSelectedPresetId] = useState(projectPresets[0]?.id ?? "");
  const selectedPreset = projectPresets.find((preset) => preset.id === selectedPresetId) ?? projectPresets[0];

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await measureAsync(
      "app",
      "read-config-file",
      async () => file.text(),
      { fileName: file.name, sizeBytes: file.size }
    );
    loadProject(parseProjectJson(text), file.name);
    event.target.value = "";
  };

  return (
    <div className="panel-scroll">
      <SectionTitle title="Load, Save" kicker="full configuration data" />
      <div className="preset-picker">
        <SelectInput label="Preset" value={selectedPresetId} options={projectPresets.map((preset) => [preset.id, preset.name])} onChange={setSelectedPresetId} />
        <button
          onClick={() => {
            if (!selectedPreset) return;
            if (window.confirm(`Load ${selectedPreset.name}? This replaces the current configuration.`)) {
              loadProject(cloneProjectState(selectedPreset.state), selectedPreset.name);
            }
          }}
        >
          Load Preset
        </button>
      </div>
      <div className="export-actions">
        <button
          onClick={() => {
            debugLog("app", "save-browser-state", { fileName: "Browser save" });
            window.localStorage.setItem("domelab-project-state", JSON.stringify(state));
            setFileName("Browser save");
          }}
        >
          Save to Browser
        </button>
        <button
          onClick={() => {
            const saved = window.localStorage.getItem("domelab-project-state");
            if (saved) loadProject(JSON.parse(saved) as ProjectState, "Browser save");
          }}
        >
          Load Browser Save
        </button>
        <button
          onClick={() => {
            debugLog("app", "export-config-json", {
              surface: state.surface.kind,
              pattern: state.pattern.kind
            });
            downloadTextFile("domelab-configuration.json", createProjectJson(state), "application/json");
          }}
        >
          Download Config
        </button>
        <button onClick={() => inputRef.current?.click()}>Load Config</button>
        <input ref={inputRef} type="file" accept="application/json,.json" onChange={handleImport} hidden />
      </div>
    </div>
  );
};

const ExportPanel = ({ built, state }: { built: BuiltProject; state: ProjectState }) => {
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [quoteStatus, setQuoteStatus] = useState<string | null>(null);
  const [viewOptions, setViewOptions] = useState<QuoteViewOption[]>(() =>
    defaultQuoteViewOptions.map((option) => ({ ...option }))
  );
  const selectedViewCount = viewOptions.filter((option) => option.include).length;

  const handleDocxExport = async () => {
    setIsExportingDocx(true);
    setQuoteStatus("Building simple quote DOCX...");
    try {
      const blob = await measureAsync(
        "app",
        "export-quote-docx",
        () => createQuoteDocxWithViews(built, state, viewOptions),
        { selectedViews: selectedViewCount }
      );
      downloadBlob("domelab-fabricator-quote-request.docx", blob);
      setQuoteStatus("DOCX quote request downloaded.");
    } catch (error) {
      console.error(error);
      setQuoteStatus("DOCX export failed. Please try again.");
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <div className="panel-scroll">
      <SectionTitle title="Exports" />
      <SectionTitle title="Quote View Options" kicker="views included in DOCX export" />
      <div className="export-view-list">
        {viewOptions.map((option) => (
          <div key={option.view} className="export-view-row">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={option.include}
                onChange={(event) =>
                  setViewOptions((current) =>
                    current.map((item) => (item.view === option.view ? { ...item, include: event.target.checked } : item))
                  )
                }
              />
              <span>{quoteViewLabel(option.view)}</span>
            </label>
            <label className="field inline-field">
              <span>Projection</span>
              <select
                value={option.projection}
                disabled={!option.include}
                onChange={(event) =>
                  setViewOptions((current) =>
                    current.map((item) =>
                      item.view === option.view ? { ...item, projection: event.target.value as QuoteProjectionMode } : item
                    )
                  )
                }
              >
                <option value="perspective">Perspective</option>
                <option value="axonometric">Axonometric</option>
              </select>
            </label>
            <label className="toggle-row compact-toggle">
              <input
                type="checkbox"
                checked={option.frontHemisphereOnly}
                disabled={!option.include}
                onChange={(event) =>
                  setViewOptions((current) =>
                    current.map((item) =>
                      item.view === option.view ? { ...item, frontHemisphereOnly: event.target.checked } : item
                    )
                  )
                }
              />
              <span>Front only</span>
            </label>
          </div>
        ))}
      </div>
      <div className="export-actions">
        <button onClick={handleDocxExport} disabled={isExportingDocx || selectedViewCount === 0}>
          {isExportingDocx ? "Building DOCX..." : "Export Quote DOCX"}
        </button>
        <button
          onClick={() => {
            debugLog("app", "export-bom-csv", {
              strutGroups: built.bom.strutGroups.length,
              nodeGroups: built.bom.nodeGroups.length
            });
            downloadTextFile("domelab-bom.csv", createBomCsv(built, state), "text/csv");
          }}
        >
          Export CSV
        </button>
        <button
          onClick={() => {
            debugLog("app", "export-project-json", {
              surface: state.surface.kind,
              pattern: state.pattern.kind
            });
            downloadTextFile("domelab-configuration.json", createProjectJson(state), "application/json");
          }}
        >
          Export JSON
        </button>
      </div>
      <p className="disclaimer">
        The DOCX quote request includes a geometry summary, the selected reference views, a simplified BOM, blank material and surface finish fields, and palletized EXW shipping notes.
      </p>
      {selectedViewCount === 0 && <p className="disclaimer">Select at least one view to enable DOCX export.</p>}
      {quoteStatus && <p className="disclaimer">{quoteStatus}</p>}
    </div>
  );
};

const DebugPanel = () => {
  const [entries, setEntries] = useState(() => getDebugLogEntries());

  useEffect(() => subscribeDebugLogs(() => setEntries(getDebugLogEntries())), []);

  const newestEntry = entries.at(-1);
  const visibleEntries = [...entries].reverse();

  return (
    <div className="panel-scroll">
      <SectionTitle title="Debug Log" kicker="live timestamped event buffer" />
      <SummaryGrid
        items={[
          ["Entries", number(entries.length)],
          ["Newest", newestEntry ? newestEntry.timestampIso : "—"],
          ["Latest scope", newestEntry ? newestEntry.scope : "—"]
        ]}
      />
      <div className="export-actions">
        <button
          onClick={() => {
            debugLog("debug-panel", "download-log", { entryCount: entries.length });
            downloadTextFile("domelab-debug-log.txt", formatDebugLogEntries(entries), "text/plain");
          }}
          disabled={entries.length === 0}
        >
          Download Log
        </button>
        <button
          onClick={() => {
            clearDebugLogs();
            debugLog("debug-panel", "logs-cleared");
            setEntries(getDebugLogEntries());
          }}
        >
          Clear Log
        </button>
      </div>
      <p className="disclaimer">
        This panel mirrors the browser console log with ISO timestamps and elapsed session time. In dev mode,
        React Strict Mode can duplicate some startup and render logs.
      </p>
      <div className="debug-log-list">
        {visibleEntries.length > 0 ? (
          visibleEntries.map((entry) => (
            <div key={entry.id} className={`debug-log-entry ${entry.level}`}>
              <strong>{entry.line}</strong>
              {entry.data && Object.keys(entry.data).length > 0 && <pre>{JSON.stringify(entry.data, null, 2)}</pre>}
            </div>
          ))
        ) : (
          <div className="debug-log-entry empty">
            <strong>No log entries yet.</strong>
            <span>Open other tabs, change settings, or run an export to populate the buffer.</span>
          </div>
        )}
      </div>
    </div>
  );
};

const SelectionInspector = ({ built, state, selection }: { built: BuiltProject; state: ProjectState; selection: Selection }) => {
  if (selection.type === "none") {
    return (
      <div className="selection-inspector muted">
        <strong>No selection</strong>
        <span>Pick a strut, node, or BOM row</span>
      </div>
    );
  }
  if (selection.type === "edge") {
    const edge = built.geometry.edges.find((item) => item.id === selection.id);
    return (
      <div className="selection-inspector">
        <strong>Strut {edge?.id}</strong>
        <span>Model {metersToDisplay(edge?.modelLengthM ?? null, state.project.units)}</span>
        <span>Reference {metersToDisplay(edge?.fabricationLengthM ?? null, state.project.units)}</span>
        <span>Cut {metersToDisplay(edge?.cutLengthM ?? null, state.project.units)}</span>
      </div>
    );
  }
  if (selection.type === "node") {
    const node = built.geometry.nodes.find((item) => item.id === selection.id);
    return (
      <div className="selection-inspector">
        <strong>Node {node?.id}</strong>
        <span>Valence {node?.valence}</span>
        <span>{node?.role}</span>
      </div>
    );
  }
  const group =
    selection.type === "strut-group"
      ? built.bom.strutGroups.find((item) => item.id === selection.id)
      : built.bom.nodeGroups.find((item) => item.id === selection.id);
  return (
    <div className="selection-inspector">
      <strong>{selection.type === "strut-group" ? "Strut group" : "Node group"} {group?.label}</strong>
      <span>Qty {group?.quantity}</span>
      <span>{selection.type === "strut-group" ? "highlighted in model" : "nodes highlighted"}</span>
    </div>
  );
};

const ControlGroup = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="control-group">
    <h3>{label}</h3>
    {children}
  </section>
);

const SectionTitle = ({ title, kicker }: { title: string; kicker?: string }) => (
  <div className="section-title">
    {kicker && <span>{kicker}</span>}
    <h2>{title}</h2>
  </div>
);

const Segmented = ({
  value,
  options,
  onChange
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) => (
  <div className="segmented">
    {options.map(([option, label]) => (
      <button key={option} className={value === option ? "active" : ""} onClick={() => onChange(option)}>
        {label}
      </button>
    ))}
  </div>
);

const NumericInput = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) => (
  <label className="field">
    <span>{label}</span>
    <input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
);

const NullableNumericInput = ({
  label,
  value,
  onChange
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) => (
  <label className="field">
    <span>{label}</span>
    <input
      type="number"
      value={value !== null && Number.isFinite(value) ? value : ""}
      placeholder="—"
      onChange={(event) => {
        const next = event.target.value.trim();
        const parsed = Number(next);
        onChange(next === "" || !Number.isFinite(parsed) ? null : parsed);
      }}
    />
  </label>
);

const TextInput = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <label className="field">
    <span>{label}</span>
    <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const TextAreaInput = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <label className="field description-field">
    <span>{label}</span>
    <textarea value={value} placeholder="Add project notes..." onChange={(event) => onChange(event.target.value)} />
  </label>
);

const SelectInput = ({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) => (
  <label className="field">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([option, labelText]) => (
        <option key={option} value={option}>{labelText}</option>
      ))}
    </select>
  </label>
);

const SummaryGrid = ({ items }: { items: Array<[string, string]> }) => (
  <div className="summary-grid">
    {items.map(([label, value]) => (
      <div key={label}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    ))}
  </div>
);

const Warnings = ({ warnings }: { warnings: BuiltProject["bom"]["warnings"] }) => {
  if (warnings.length === 0) return <div className="warning-pill ok">No validation warnings</div>;
  return (
    <div className="warnings">
      {warnings.map((warning, index) => (
        <div key={`${warning.code}-${index}`} className={`warning-pill ${warning.level}`}>{warning.message}</div>
      ))}
    </div>
  );
};

const updateMaterial = (
  updateState: (updater: (state: ProjectState) => ProjectState) => void,
  key: keyof Pick<ProjectState["material"], "costPerMeter" | "stockLengthM" | "wasteFactor" | "endOperationCostPerEnd" | "nodeBaseCost" | "nodePerStrutAdder" | "setupCost" | "contingencyPercent">,
  value: number | null
) => updateState((current) => ({ ...current, material: { ...current.material, [key]: value } }));

const equatorHeightAboveGround = (state: ProjectState): number | null => {
  if (state.surface.kind === "spherical") return Math.max(0, -state.surface.spherical.verticalCutPositionM);
  if (state.surface.kind === "ellipsoidal") {
    const c = state.surface.ellipsoidal.zHeightM / 2;
    return Math.max(0, state.surface.ellipsoidal.truncationHeightM - c);
  }
  if (state.surface.kind === "onion") return state.surface.onion.shoulderHeightM;
  return 0;
};

const sphericalHeightFromBaseDiameter = (diameterM: number, baseDiameterM: number, currentHeightM: number): number => {
  const radius = diameterM / 2;
  const baseRadius = clamp(baseDiameterM / 2, 0, radius);
  const planeMagnitude = Math.sqrt(Math.max(0, radius * radius - baseRadius * baseRadius));
  const planeZ = currentHeightM > radius ? -planeMagnitude : planeMagnitude;
  return clamp(radius - planeZ, 0.05, diameterM);
};

const sphericalHeightFromVerticalCut = (diameterM: number, verticalCutPositionM: number): number =>
  clamp(diameterM / 2 - verticalCutPositionM, 0.05, diameterM);

const quoteViewLabel = (view: QuoteViewName): string => {
  if (view === "plan") return "Plan";
  if (view === "elevation") return "Elevation";
  return "Isometric";
};

const costDisplay = (value: number | null, _state: ProjectState): string => value === null ? "—" : currency(value, "USD");
const nullableNumber = (value: number | null, digits = 0): string => value === null ? "—" : number(value, digits);
const scrapPercent = (yieldPercent: number | null): number | null => yieldPercent === null ? null : 100 - yieldPercent;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
