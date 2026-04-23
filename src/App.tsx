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
import { snapGeodesicCoverageToNodeLayer } from "./geometry/geodesic";
import type { BuiltProject, ProjectState, Selection, ShapeMode, StructurePattern } from "./types";
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
    setState((current) => normalizeProjectState(updater(current)));
    setSelection({ type: "none" });
  };

  const loadProject = (nextState: ProjectState, nextFileName: string) => {
    debugLog("app", "load-project", {
      fileName: nextFileName,
      pattern: nextState.geometry.pattern,
      shape: nextState.geometry.shape,
      diameterM: Number(nextState.geometry.diameterM.toFixed(3))
    });
    setState(normalizeProjectState(nextState));
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
    <Metric label="Diameter" value={metersToDisplay(state.geometry.diameterM, state.project.units)} onClick={() => onTab("3D Model")} />
    <Metric
      label="Equator above ground"
      value={metersToDisplay(equatorHeightAboveGround(built), state.project.units)}
      onClick={() => onTab("3D Model")}
    />
    <Metric label="Pattern" value={patternLabel(state.geometry.pattern)} onClick={() => onTab("3D Model")} />
    <Metric label="Density" value={densityLabel(state)} onClick={() => onTab("3D Model")} />
    <Metric label="Nodes" value={number(built.geometry.nodes.length)} onClick={() => onTab("BOM")} />
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
}) => (
  <div className="panel-scroll">
    <SectionTitle title="Design Controls" />
    <ControlGroup label="Structure pattern">
      <Segmented
        value={state.geometry.pattern}
        options={[
          ["geodesic", "Geodesic"],
          ["lamella", "Lamella"],
          ["ribbed-rectangular", "Ribbed"]
        ]}
        onChange={(value) =>
          updateState((current) => ({
            ...current,
            geometry: { ...current.geometry, pattern: value as StructurePattern }
          }))
        }
      />
    </ControlGroup>
    <SphereCoverageControl state={state} updateState={updateState} />
    <div className="control-grid two">
      <NumericInput
        label="Diameter (m)"
        value={state.geometry.diameterM}
        min={0.1}
        max={50}
        step={0.1}
        onChange={(value) =>
          updateState((current) => ({
            ...current,
            geometry: geometryForCoverage(current, { ...current.geometry, diameterM: value }, sphereCoverage(current), sphereFlatBase(current))
          }))
        }
      />
      <NumericInput
        label="Strut diameter (mm)"
        value={state.material.strutDiameterMm}
        min={1}
        step={1}
        onChange={(value) =>
          updateState((current) => ({ ...current, material: { ...current.material, strutDiameterMm: value } }))
        }
      />
    </div>
    {state.geometry.pattern === "geodesic" && (
      <ControlGroup label="Geodesic frequency">
        <div className="stepper-row">
          <button
            className="icon-button"
            onClick={() =>
              updateState((current) => ({
                ...current,
                geodesic: {
                  ...current.geodesic,
                  frequency: Math.max(1, current.geodesic.frequency - 1) as ProjectState["geodesic"]["frequency"]
                }
              }))
            }
          >
            -
          </button>
          <input
            type="range"
            min={1}
            max={8}
            value={state.geodesic.frequency}
            onChange={(event) =>
              updateState((current) => ({
                ...current,
                geodesic: {
                  ...current.geodesic,
                  frequency: Number(event.target.value) as ProjectState["geodesic"]["frequency"]
                }
              }))
            }
          />
          <button
            className="icon-button"
            onClick={() =>
              updateState((current) => ({
                ...current,
                geodesic: {
                  ...current.geodesic,
                  frequency: Math.min(8, current.geodesic.frequency + 1) as ProjectState["geodesic"]["frequency"]
                }
              }))
            }
          >
            +
          </button>
          <strong>{state.geodesic.frequency}V</strong>
        </div>
      </ControlGroup>
    )}
    {state.geometry.pattern === "lamella" && <LamellaControls state={state} updateState={updateState} />}
    {state.geometry.pattern === "ribbed-rectangular" && <RibbedControls state={state} updateState={updateState} />}
    <Warnings warnings={warnings} />
  </div>
);

const SphereCoverageControl = ({
  state,
  updateState
}: {
  state: ProjectState;
  updateState: (updater: (state: ProjectState) => ProjectState) => void;
}) => {
  const coverage = sphereCoverage(state);
  const flatBase = sphereFlatBase(state);
  return (
    <ControlGroup label="Sphere coverage">
      <div className="coverage-control">
        <input
          type="range"
          min={50}
          max={100}
          step={0.5}
          value={Number((coverage * 100).toFixed(1))}
          onChange={(event) =>
            updateState((current) => ({
              ...current,
              geometry: geometryForCoverage(current, current.geometry, Number(event.target.value) / 100, sphereFlatBase(current))
            }))
          }
        />
        <div className="coverage-readout">
          <strong>{coverageLabel(coverage)}</strong>
          <span>{coverage === 1 ? "Full sphere" : "Layered cap / dome"}</span>
        </div>
      </div>
      {state.geometry.pattern === "geodesic" && (
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
            <span>Snap to nearest clean node layer</span>
          </label>
          <p className="toggle-note">Shifts coverage to the closest geodesic node layer so near-overlapping boundary nodes collapse into one node.</p>
        </>
      )}
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={flatBase}
          onChange={(event) =>
            updateState((current) => ({
              ...current,
              geometry: geometryForCoverage(current, current.geometry, sphereCoverage(current), event.target.checked)
            }))
          }
        />
        <span>Flat base</span>
      </label>
    </ControlGroup>
  );
};

const LamellaControls = ({
  state,
  updateState
}: {
  state: ProjectState;
  updateState: (updater: (state: ProjectState) => ProjectState) => void;
}) => (
  <div className="control-grid two">
    <NumericInput
      label="Sectors"
      value={state.lamella.sectors}
      min={3}
      step={1}
      onChange={(value) =>
        updateState((current) => ({ ...current, lamella: { ...current.lamella, sectors: Math.round(value) } }))
      }
    />
    <NumericInput
      label="Rings"
      value={state.lamella.rings}
      min={1}
      step={1}
      onChange={(value) =>
        updateState((current) => ({ ...current, lamella: { ...current.lamella, rings: Math.round(value) } }))
      }
    />
  </div>
);

const RibbedControls = ({
  state,
  updateState
}: {
  state: ProjectState;
  updateState: (updater: (state: ProjectState) => ProjectState) => void;
}) => (
  <div className="control-grid two">
    <NumericInput
      label="Ribs"
      value={state.ribbedRectangular.ribs}
      min={3}
      step={1}
      onChange={(value) =>
        updateState((current) => ({
          ...current,
          ribbedRectangular: { ...current.ribbedRectangular, ribs: Math.round(value) }
        }))
      }
    />
    <NumericInput
      label="Rings"
      value={state.ribbedRectangular.rings}
      min={1}
      step={1}
      onChange={(value) =>
        updateState((current) => ({
          ...current,
          ribbedRectangular: { ...current.ribbedRectangular, rings: Math.round(value) }
        }))
      }
    />
  </div>
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
              pattern: state.geometry.pattern,
              shape: state.geometry.shape
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
              pattern: state.geometry.pattern,
              shape: state.geometry.shape
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

const normalizeProjectState = (state: ProjectState): ProjectState => {
  if (state.geometry.pattern !== "geodesic" || !(state.geometry.snapCoverageToNodeLayer ?? false)) {
    return state;
  }

  return {
    ...state,
    geometry: geometryForCoverage(state, state.geometry, sphereCoverage(state), sphereFlatBase(state))
  };
};

const equatorHeightAboveGround = (built: BuiltProject): number | null => {
  if (built.geometry.nodes.length === 0) return null;
  const minZ = Math.min(...built.geometry.nodes.map((node) => node.position[2]));
  return Math.max(0, -minZ);
};

const sphereCoverage = (state: ProjectState): number => {
  const explicit = state.geometry.sphereCoverage;
  if (explicit !== undefined) return clamp(explicit, 0.5, 1);
  if (state.geometry.shape === "full-sphere") return 1;
  if (state.geometry.shape === "hemisphere") return 0.5;
  if (state.geometry.capHeightM !== undefined) return clamp(state.geometry.capHeightM / state.geometry.diameterM, 0.5, 1);
  return 1;
};

const sphereFlatBase = (state: ProjectState): boolean => state.geometry.flatBase ?? state.geometry.shape === "flattened-base";

const geometryForCoverage = (
  state: ProjectState,
  geometry: ProjectState["geometry"],
  coverageValue: number,
  flatBase: boolean
): ProjectState["geometry"] => {
  const snapEnabled = geometry.pattern === "geodesic" && (geometry.snapCoverageToNodeLayer ?? false);
  const coverage = snapEnabled ? snapGeodesicCoverageToNodeLayer(geometry, state.geodesic, coverageValue) : clamp(coverageValue, 0.5, 1);
  const radius = geometry.diameterM / 2;
  const capHeightM = geometry.diameterM * coverage;
  const cutPlaneZ = radius - capHeightM;
  const shape: ShapeMode =
    coverage >= 0.995 ? "full-sphere" : flatBase ? "flattened-base" : Math.abs(coverage - 0.5) < 0.005 ? "hemisphere" : "spherical-cap";
  return {
    ...geometry,
    shape,
    sphereCoverage: coverage,
    flatBase,
    capHeightM,
    cutPlaneZ,
    topCutPlaneZ: radius,
    bottomCutPlaneZ: cutPlaneZ
  };
};

const coverageLabel = (coverage: number): string => {
  const percentValue = Math.round(coverage * 100);
  if (coverage >= 0.995) return "100% sphere";
  if (Math.abs(coverage - 0.625) < 0.005) return "5/8 sphere (62.5%)";
  if (Math.abs(coverage - 0.75) < 0.005) return "3/4 sphere (75%)";
  if (Math.abs(coverage - 0.5) < 0.005) return "1/2 sphere (50%)";
  return `${percentValue}% sphere`;
};

const patternLabel = (pattern: StructurePattern): string => {
  if (pattern === "geodesic") return "Geodesic";
  if (pattern === "lamella") return "Lamella";
  return "Ribbed rectangular";
};

const quoteViewLabel = (view: QuoteViewName): string => {
  if (view === "plan") return "Plan";
  if (view === "elevation") return "Elevation";
  return "Isometric";
};

const densityLabel = (state: ProjectState): string => {
  if (state.geometry.pattern === "geodesic") return `${state.geodesic.frequency}V`;
  if (state.geometry.pattern === "lamella") return `${state.lamella.sectors} sectors / ${state.lamella.rings} rings`;
  return `${state.ribbedRectangular.ribs} ribs / ${state.ribbedRectangular.rings} rings`;
};

const costDisplay = (value: number | null, _state: ProjectState): string => value === null ? "—" : currency(value, "USD");
const nullableNumber = (value: number | null, digits = 0): string => value === null ? "—" : number(value, digits);
const scrapPercent = (yieldPercent: number | null): number | null => yieldPercent === null ? null : 100 - yieldPercent;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
