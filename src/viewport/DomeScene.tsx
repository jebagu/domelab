import { Grid, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { BuiltProject, DisplayMode, Edge, Node, Selection } from "../types";
import { valenceColor } from "../utils/colors";
import { debugLog, measureAsync } from "../utils/debug";

const structureGreen = "#5eead4";
const darkBackground = "#071014";
const plainBackground = "#ffffff";
const blackLineColor = "#111111";
const pinkLineColor = "#f75ba7";
const selectedBlackLineColor = "#0f766e";
const selectedPinkLineColor = "#be185d";

export type ViewCameraMode = "plan" | "elevation" | "isometric";
export type ViewProjectionMode = "perspective" | "axonometric";
export type ViewRenderStyle = "color" | "pink-lines" | "plain-lines";

export interface DomeSceneHandle {
  exportPng: () => Promise<Blob | null>;
}

interface DomeSceneProps {
  built: BuiltProject;
  displayMode: DisplayMode;
  selection: Selection;
  spin: boolean;
  strutDiameterMm: number;
  cameraView: ViewCameraMode;
  projectionMode: ViewProjectionMode;
  renderStyle: ViewRenderStyle;
  fogDensity: number;
  frontHemisphereOnly: boolean;
  resetVersion: number;
  onSelect: (selection: Selection) => void;
}

export const DomeScene = forwardRef<DomeSceneHandle, DomeSceneProps>(function DomeScene(
  {
    built,
    displayMode,
    selection,
    spin,
    strutDiameterMm,
    cameraView,
    projectionMode,
    renderStyle,
    fogDensity,
    frontHemisphereOnly,
    resetVersion,
    onSelect
  },
  ref
) {
  const radius = modelRadius(built);
  const scene = sceneMetrics(radius);
  const exportPngRef = useRef<() => Promise<Blob | null>>(async () => null);
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const clippingPlanes = frontHemisphereOnly ? [clipPlane] : [];
  const groupByEdge = useMemo(() => {
    const map = new Map<string, { id: string; index: number; cost: number | null }>();
    built.bom.strutGroups.forEach((group, index) => {
      group.edgeIds.forEach((edgeId) => map.set(edgeId, { id: group.id, index, cost: group.estimatedCost }));
    });
    return map;
  }, [built.bom.strutGroups]);

  const groupByNode = useMemo(() => {
    const map = new Map<string, { id: string; index: number }>();
    built.bom.nodeGroups.forEach((group, index) => {
      group.nodeIds.forEach((nodeId) => map.set(nodeId, { id: group.id, index }));
    });
    return map;
  }, [built.bom.nodeGroups]);

  useImperativeHandle(
    ref,
    () => ({
      exportPng: () => exportPngRef.current()
    }),
    []
  );

  return (
    <Canvas
      shadows={renderStyle === "color"}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: scene.initialCamera.toArray(), fov: 42, near: scene.near, far: scene.far }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
      }}
    >
      {projectionMode === "perspective" ? (
        <PerspectiveCamera
          makeDefault
          position={scene.initialCamera.toArray()}
          fov={42}
          near={scene.near}
          far={scene.far}
        />
      ) : (
        <OrthographicCamera
          makeDefault
          position={scene.initialCamera.toArray()}
          near={scene.near}
          far={scene.far}
          zoom={orthographicZoom(radius, 1200, 900)}
        />
      )}
      <SceneRuntimeBridge
        spin={spin}
        modelRadius={radius}
        cameraView={cameraView}
        projectionMode={projectionMode}
        renderStyle={renderStyle}
        fogDensity={fogDensity}
        frontHemisphereOnly={frontHemisphereOnly}
        resetVersion={resetVersion}
        clipPlane={clipPlane}
        exportPngRef={exportPngRef}
      />
      {renderStyle === "color" && (
        <>
          <ambientLight intensity={1.05} />
          <directionalLight position={[radius * 1.2, -radius * 1.6, radius * 2.4]} intensity={1.85} castShadow />
          <directionalLight position={[-radius * 2, radius * 1.8, radius * 1.1]} intensity={0.75} color="#bafcf1" />
          <pointLight
            position={[-radius * 1.3, radius * 0.9, radius * 1.8]}
            intensity={2.1}
            distance={radius * 8}
            color={structureGreen}
          />
        </>
      )}
      <group onPointerMissed={() => onSelect({ type: "none" })}>
        {renderStyle === "color" ? (
          <>
            <FaceMesh built={built} clippingPlanes={clippingPlanes} />
            <StrutInstances
              edges={built.geometry.edges}
              nodes={built.geometry.nodes}
              groups={built.bom.strutGroups}
              groupByEdge={groupByEdge}
              displayMode={displayMode}
              selection={selection}
              renderedRadiusM={renderedStrutRadius(strutDiameterMm, radius)}
              clippingPlanes={clippingPlanes}
              onSelect={onSelect}
            />
            <NodeInstances
              nodes={built.geometry.nodes}
              groupByNode={groupByNode}
              displayMode={displayMode}
              selection={selection}
              clippingPlanes={clippingPlanes}
              onSelect={onSelect}
            />
          </>
        ) : (
          <PlainLineSegments
            edges={built.geometry.edges}
            nodes={built.geometry.nodes}
            groups={built.bom.strutGroups}
            groupByEdge={groupByEdge}
            renderStyle={renderStyle}
            selection={selection}
            clippingPlanes={clippingPlanes}
            onSelect={onSelect}
          />
        )}
      </group>
      {renderStyle === "color" && (
        <Grid
          position={[0, 0, -built.geometry.nodes.reduce((min, node) => Math.min(min, node.position[2]), 0) - 0.02]}
          args={[scene.gridSize, scene.gridSize]}
          cellSize={scene.gridCellSize}
          cellThickness={0.35}
          cellColor="#1d3c42"
          sectionSize={scene.gridSectionSize}
          sectionThickness={0.8}
          sectionColor="#2dd4bf"
          fadeDistance={scene.gridFadeDistance}
          fadeStrength={1.4}
          infiniteGrid
        />
      )}
    </Canvas>
  );
});

interface SceneRuntimeBridgeProps {
  spin: boolean;
  modelRadius: number;
  cameraView: ViewCameraMode;
  projectionMode: ViewProjectionMode;
  renderStyle: ViewRenderStyle;
  fogDensity: number;
  frontHemisphereOnly: boolean;
  resetVersion: number;
  clipPlane: THREE.Plane;
  exportPngRef: MutableRefObject<() => Promise<Blob | null>>;
}

const SceneRuntimeBridge = ({
  spin,
  modelRadius,
  cameraView,
  projectionMode,
  renderStyle,
  fogDensity,
  frontHemisphereOnly,
  resetVersion,
  clipPlane,
  exportPngRef
}: SceneRuntimeBridgeProps) => {
  const controlsRef = useRef<any>(null);
  const { camera, gl, scene, size, invalidate } = useThree();

  useEffect(() => {
    const backgroundColor = renderStyle === "plain-lines" ? plainBackground : darkBackground;
    scene.background = new THREE.Color(backgroundColor);
    if (fogDensity <= 0) {
      scene.fog = null;
      return;
    }
    const { near, far } = fogRange(modelRadius, fogDensity);
    scene.fog = new THREE.Fog(backgroundColor, near, far);
    return () => {
      scene.fog = null;
    };
  }, [fogDensity, modelRadius, renderStyle, scene]);

  useEffect(() => {
    applyCameraView(camera, controlsRef.current, cameraView, modelRadius, size.width, size.height);
    invalidate();
  }, [camera, cameraView, modelRadius, projectionMode, resetVersion, size.height, size.width, invalidate]);

  useEffect(() => {
    exportPngRef.current = async () => {
      invalidate();
      return exportScenePng(gl, scene, camera);
    };
    return () => {
      exportPngRef.current = async () => null;
    };
  }, [camera, exportPngRef, gl, invalidate, scene]);

  useEffect(() => {
    debugLog("viewport", "view-controls", {
      cameraView,
      projectionMode,
      renderStyle,
      fogDensity,
      frontHemisphereOnly
    });
  }, [cameraView, fogDensity, frontHemisphereOnly, projectionMode, renderStyle]);

  useFrame(() => {
    if (frontHemisphereOnly) {
      updateClipPlane(clipPlane, camera);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      autoRotate={spin}
      autoRotateSpeed={0.7}
      enableDamping
      enablePan={false}
      dampingFactor={0.08}
    />
  );
};

interface StrutInstancesProps {
  edges: Edge[];
  nodes: Node[];
  groups: Array<{ id: string; edgeIds: string[]; estimatedCost: number | null }>;
  groupByEdge: Map<string, { id: string; index: number; cost: number | null }>;
  displayMode: DisplayMode;
  selection: Selection;
  renderedRadiusM: number;
  clippingPlanes: THREE.Plane[];
  onSelect: (selection: Selection) => void;
}

const StrutInstances = ({
  edges,
  nodes,
  groups,
  groupByEdge,
  displayMode,
  selection,
  renderedRadiusM,
  clippingPlanes,
  onSelect
}: StrutInstancesProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedEdgeIds = useMemo(() => selectedEdges(selection, groups), [selection, groups]);
  const maxCost = useMemo(() => Math.max(1, ...groups.map((group) => group.estimatedCost ?? 0)), [groups]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const yAxis = new THREE.Vector3(0, 1, 0);
    edges.forEach((edge, index) => {
      const a = new THREE.Vector3(...nodeMap.get(edge.nodeA)!.position);
      const b = new THREE.Vector3(...nodeMap.get(edge.nodeB)!.position);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const direction = b.clone().sub(a);
      const length = direction.length();
      dummy.position.copy(mid);
      dummy.quaternion.setFromUnitVectors(yAxis, direction.clone().normalize());
      dummy.scale.set(1, length, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, new THREE.Color(strutColor(edge, groupByEdge, displayMode, selectedEdgeIds, maxCost)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [displayMode, edges, groupByEdge, maxCost, nodeMap, selectedEdgeIds]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, edges.length]}
      castShadow
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        const edge = edges[event.instanceId ?? 0];
        onSelect({ type: "edge", id: edge.id, groupId: groupByEdge.get(edge.id)?.id });
      }}
    >
      <cylinderGeometry args={[renderedRadiusM, renderedRadiusM, 1, 14]} />
      <meshPhysicalMaterial
        color={structureGreen}
        roughness={0.18}
        metalness={0.32}
        clearcoat={0.7}
        clearcoatRoughness={0.16}
        emissive="#0b4a40"
        emissiveIntensity={0.32}
        clippingPlanes={clippingPlanes}
        clipShadows
        fog
      />
    </instancedMesh>
  );
};

interface NodeInstancesProps {
  nodes: Node[];
  groupByNode: Map<string, { id: string; index: number }>;
  displayMode: DisplayMode;
  selection: Selection;
  clippingPlanes: THREE.Plane[];
  onSelect: (selection: Selection) => void;
}

const NodeInstances = ({ nodes, groupByNode, displayMode, selection, clippingPlanes, onSelect }: NodeInstancesProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const selectedNodeIds = useMemo(() => selectedNodes(selection, groupByNode), [selection, groupByNode]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    nodes.forEach((node, index) => {
      dummy.position.set(...node.position);
      const selected = selectedNodeIds.has(node.id);
      const radius = selected ? 0.072 : node.role === "crown" || node.role === "base" ? 0.052 : 0.043;
      dummy.scale.setScalar(radius);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      const color =
        displayMode === "node-valence"
          ? valenceColor(node.valence)
          : selected
            ? "#ffffff"
            : node.role === "base" || node.role === "boundary"
              ? "#facc15"
              : "#c7f9ff";
      mesh.setColorAt(index, new THREE.Color(color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [displayMode, nodes, selectedNodeIds]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      castShadow
      onClick={(event) => {
        event.stopPropagation();
        const node = nodes[event.instanceId ?? 0];
        onSelect({ type: "node", id: node.id, groupId: groupByNode.get(node.id)?.id });
      }}
    >
      <sphereGeometry args={[1, 20, 12]} />
      <meshStandardMaterial
        vertexColors
        roughness={0.32}
        metalness={0.35}
        emissive="#07272c"
        emissiveIntensity={0.3}
        clippingPlanes={clippingPlanes}
      />
    </instancedMesh>
  );
};

interface PlainLineSegmentsProps {
  edges: Edge[];
  nodes: Node[];
  groups: Array<{ id: string; edgeIds: string[] }>;
  groupByEdge: Map<string, { id: string; index: number; cost: number | null }>;
  renderStyle: Extract<ViewRenderStyle, "pink-lines" | "plain-lines">;
  selection: Selection;
  clippingPlanes: THREE.Plane[];
  onSelect: (selection: Selection) => void;
}

const PlainLineSegments = ({
  edges,
  nodes,
  groups,
  groupByEdge,
  renderStyle,
  selection,
  clippingPlanes,
  onSelect
}: PlainLineSegmentsProps) => {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node.position])), [nodes]);
  const selectedEdgeIds = useMemo(() => selectedEdges(selection, groups), [selection, groups]);
  const palette = wireframePalette(renderStyle);
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    edges.forEach((edge) => {
      const start = nodeMap.get(edge.nodeA);
      const end = nodeMap.get(edge.nodeB);
      if (!start || !end) return;
      positions.push(...start, ...end);
      const color = new THREE.Color(selectedEdgeIds.has(edge.id) ? palette.selectedLine : palette.line);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    });
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    buffer.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return buffer;
  }, [edges, nodeMap, palette.line, palette.selectedLine, selectedEdgeIds]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments
      geometry={geometry}
      onClick={(event) => {
        event.stopPropagation();
        const segmentIndex = Math.floor((event.index ?? 0) / 2);
        const edge = edges[segmentIndex];
        if (!edge) return;
        onSelect({ type: "edge", id: edge.id, groupId: groupByEdge.get(edge.id)?.id });
      }}
    >
      <lineBasicMaterial color={palette.line} vertexColors clippingPlanes={clippingPlanes} fog />
    </lineSegments>
  );
};

const FaceMesh = ({ built, clippingPlanes }: { built: BuiltProject; clippingPlanes: THREE.Plane[] }) => {
  const geometry = useMemo(() => {
    const nodeMap = new Map(built.geometry.nodes.map((node) => [node.id, node.position]));
    const vertices: number[] = [];
    built.geometry.faces.forEach((face) => {
      face.nodeIds.forEach((id) => vertices.push(...nodeMap.get(id)!));
    });
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    buffer.computeVertexNormals();
    return buffer;
  }, [built.geometry.faces, built.geometry.nodes]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  if (built.geometry.faces.length === 0) return null;
  return (
    <mesh geometry={geometry} renderOrder={-1}>
      <meshStandardMaterial
        color="#0f2e35"
        transparent
        opacity={0.12}
        roughness={0.9}
        side={THREE.DoubleSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
};

const applyCameraView = (
  camera: THREE.Camera,
  controls: any,
  view: ViewCameraMode,
  modelRadius: number,
  viewportWidth: number,
  viewportHeight: number
) => {
  const distance = cameraDistance(modelRadius);
  const pose = cameraPose(view, distance);
  camera.up.copy(pose.up);
  camera.position.copy(pose.position);
  camera.lookAt(0, 0, 0);

  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = 42;
    camera.aspect = Math.max(1e-3, viewportWidth / Math.max(1, viewportHeight));
    camera.near = Math.max(0.01, modelRadius / 350);
    camera.far = Math.max(80, modelRadius * 14);
    camera.updateProjectionMatrix();
  } else if (camera instanceof THREE.OrthographicCamera) {
    camera.near = Math.max(0.01, modelRadius / 350);
    camera.far = Math.max(80, modelRadius * 14);
    camera.zoom = orthographicZoom(modelRadius, viewportWidth, viewportHeight);
    camera.updateProjectionMatrix();
  }

  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  }
};

const cameraPose = (
  view: ViewCameraMode,
  distance: number
): { position: THREE.Vector3; up: THREE.Vector3 } => {
  if (view === "plan") {
    return {
      position: new THREE.Vector3(0, 0, distance),
      up: new THREE.Vector3(0, 1, 0)
    };
  }
  if (view === "elevation") {
    return {
      position: new THREE.Vector3(0, -distance, 0.12 * distance),
      up: new THREE.Vector3(0, 0, 1)
    };
  }
  return {
    position: isometricPosition(distance),
    up: new THREE.Vector3(0, 0, 1)
  };
};

const exportScenePng = async (
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): Promise<Blob | null> =>
  measureAsync(
    "viewport",
    "export-png",
    async () => {
      const width = gl.domElement.clientWidth;
      const height = gl.domElement.clientHeight;
      if (width === 0 || height === 0) return null;

      const originalPixelRatio = gl.getPixelRatio();
      const exportPixelRatio = Math.max(3, Math.min(4, originalPixelRatio * 2));

      gl.setPixelRatio(exportPixelRatio);
      gl.setSize(width, height, false);
      refreshProjectionMatrix(camera);
      gl.render(scene, camera);

      const blob = await canvasToBlob(gl.domElement);

      gl.setPixelRatio(originalPixelRatio);
      gl.setSize(width, height, false);
      refreshProjectionMatrix(camera);
      gl.render(scene, camera);

      return blob;
    },
    {
      widthPx: gl.domElement.clientWidth,
      heightPx: gl.domElement.clientHeight
    }
  );

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/png");
  });

const refreshProjectionMatrix = (camera: THREE.Camera) => {
  if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
    camera.updateProjectionMatrix();
  }
};

const updateClipPlane = (clipPlane: THREE.Plane, camera: THREE.Camera) => {
  const normal = camera.position.clone();
  if (normal.lengthSq() < 1e-9) {
    normal.set(0, 0, 1);
  } else {
    normal.normalize();
  }
  clipPlane.set(normal, 0);
};

const fogRange = (radius: number, fogDensity: number): { near: number; far: number } => {
  const intensity = THREE.MathUtils.clamp(fogDensity / 100, 0, 1);
  const near = radius * (6.4 - intensity * 4.6);
  const far = radius * (16 - intensity * 10.2);
  return {
    near: Math.max(radius * 0.6, near),
    far: Math.max(radius * 1.8, far)
  };
};

const orthographicZoom = (radius: number, viewportWidth: number, viewportHeight: number): number => {
  const shortSide = Math.max(320, Math.min(viewportWidth, viewportHeight));
  return Math.max(18, shortSide / Math.max(radius * 3.4, 1));
};

const selectedEdges = (
  selection: Selection,
  groups: Array<{ id: string; edgeIds: string[] }>
): Set<string> => {
  if (selection.type === "edge") return new Set([selection.id]);
  if (selection.type === "strut-group") {
    return new Set(groups.find((group) => group.id === selection.id)?.edgeIds ?? []);
  }
  return new Set();
};

const selectedNodes = (selection: Selection, groupByNode: Map<string, { id: string; index: number }>): Set<string> => {
  if (selection.type === "node") return new Set([selection.id]);
  if (selection.type !== "node-group") return new Set();
  return new Set([...groupByNode.entries()].filter(([, group]) => group.id === selection.id).map(([nodeId]) => nodeId));
};

const strutColor = (
  edge: Edge,
  groupByEdge: Map<string, { id: string; index: number; cost: number | null }>,
  displayMode: DisplayMode,
  selectedEdgeIds: Set<string>,
  maxCost: number
): string => {
  if (selectedEdgeIds.has(edge.id)) return "#ffffff";
  return structureGreen;
};

const modelRadius = (built: BuiltProject): number =>
  Math.max(1, ...built.geometry.nodes.map((node) => Math.hypot(...node.position)));

const sceneMetrics = (radius: number) => {
  const distance = cameraDistance(radius);
  return {
    initialCamera: isometricPosition(distance),
    near: Math.max(0.01, radius / 350),
    far: Math.max(80, radius * 14),
    gridSize: Math.max(16, radius * 4),
    gridCellSize: Math.max(0.5, radius / 12),
    gridSectionSize: Math.max(2, radius / 3),
    gridFadeDistance: radius * 7
  };
};

const cameraDistance = (radius: number): number => Math.max(4, radius * 3.35);

const isometricPosition = (distance: number): THREE.Vector3 =>
  new THREE.Vector3(distance * 0.62, -distance * 0.82, distance * 0.58);

const renderedStrutRadius = (strutDiameterMm: number, radius: number): number => {
  const physicalRadius = Math.max(0.001, strutDiameterMm / 1000 / 2);
  const minimumVisible = radius * 0.0045;
  const maximumVisible = radius * 0.018;
  return Math.max(minimumVisible, Math.min(maximumVisible, physicalRadius));
};

const wireframePalette = (renderStyle: Extract<ViewRenderStyle, "pink-lines" | "plain-lines">) =>
  renderStyle === "pink-lines"
    ? {
        line: pinkLineColor,
        selectedLine: selectedPinkLineColor
      }
    : {
        line: blackLineColor,
        selectedLine: selectedBlackLineColor
      };
