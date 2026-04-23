import { configurationSummaryLine, patternKindLabel, surfaceKindLabel } from "../configuration";
import type { BuiltProject, Edge, Node, ProjectState, StrutGroup } from "../types";
import { colorForIndex } from "../utils/colors";
import { add, cross, dot, length, normalize, scale, sub, type Vec3 } from "../geometry/vector";

export const SKETCHUP_DAE_MIME = "model/vnd.collada+xml";

interface MeshData {
  positions: number[];
  normals: number[];
  triangles: number[];
}

interface GeometryEntry {
  id: string;
  name: string;
  mesh: MeshData;
  materialId: string;
  materialSymbol: string;
}

interface MaterialEntry {
  id: string;
  name: string;
  color: string;
  opacity: number;
}

const STRUT_SEGMENTS = 16;
const RING_SEGMENTS = 36;
const RING_TUBE_SEGMENTS = 8;
const NODE_SPHERE_WIDTH_SEGMENTS = 14;
const NODE_SPHERE_HEIGHT_SEGMENTS = 8;

export const createSketchupColladaBlob = (built: BuiltProject, state: ProjectState): Blob =>
  new Blob([createSketchupCollada(built, state)], { type: SKETCHUP_DAE_MIME });

export const createSketchupCollada = (built: BuiltProject, state: ProjectState): string => {
  const materials: MaterialEntry[] = [];
  const geometries: GeometryEntry[] = [];
  const groupByEdge = strutGroupByEdgeId(built.bom.strutGroups);
  const nodeMap = new Map(built.geometry.nodes.map((node) => [node.id, node]));
  const strutRadiusM = Math.max(0.001, state.material.strutDiameterMm / 2000);

  built.bom.strutGroups.forEach((group, index) => {
    const materialId = safeId(`strut_material_${group.id}`);
    materials.push({
      id: materialId,
      name: `Struts ${group.label}`,
      color: colorForIndex(index),
      opacity: 1
    });

    const mesh = createEmptyMesh();
    built.geometry.edges
      .filter((edge) => groupByEdge.get(edge.id)?.id === group.id)
      .forEach((edge) => appendEdgeTube(mesh, edge, nodeMap, strutRadiusM));

    if (mesh.triangles.length > 0) {
      geometries.push({
        id: safeId(`strut_group_${group.id}_mesh`),
        name: `${group.label} - ${group.quantity} pcs - ${formatMeters(group.modelLengthM)} nominal`,
        mesh,
        materialId,
        materialSymbol: materialId
      });
    }
  });

  const ringNodes = built.geometry.nodes.filter((node) => node.ring);
  if (ringNodes.length > 0) {
    const materialId = "ring_node_material";
    materials.push({
      id: materialId,
      name: "Ring nodes",
      color: "#d6fff6",
      opacity: 1
    });

    const mesh = createEmptyMesh();
    ringNodes.forEach((node) => appendRing(mesh, node));
    if (mesh.triangles.length > 0) {
      geometries.push({
        id: "ring_nodes_mesh",
        name: `Ring nodes - ${ringNodes.length} pcs`,
        mesh,
        materialId,
        materialSymbol: materialId
      });
    }
  } else if (state.nodes.kind === "points" && state.nodes.points.showNodeMarkers) {
    const materialId = "point_node_material";
    materials.push({
      id: materialId,
      name: "Point nodes",
      color: "#c7f9ff",
      opacity: 1
    });

    const mesh = createEmptyMesh();
    const pointRadiusM = Math.max(0.005, state.nodes.points.pointSizeMm / 2000);
    built.geometry.nodes.forEach((node) => appendSphere(mesh, node.position, pointRadiusM));
    if (mesh.triangles.length > 0) {
      geometries.push({
        id: "point_nodes_mesh",
        name: `Point nodes - ${built.geometry.nodes.length} pcs`,
        mesh,
        materialId,
        materialSymbol: materialId
      });
    }
  }

  const created = new Date().toISOString();
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">',
    createAssetXml(created, state),
    createEffectsXml(materials),
    createMaterialsXml(materials),
    createGeometriesXml(geometries),
    createSceneXml(geometries, state),
    "</COLLADA>"
  ].join("\n");
};

const strutGroupByEdgeId = (groups: StrutGroup[]): Map<string, StrutGroup> => {
  const map = new Map<string, StrutGroup>();
  groups.forEach((group) => group.edgeIds.forEach((edgeId) => map.set(edgeId, group)));
  return map;
};

const createEmptyMesh = (): MeshData => ({
  positions: [],
  normals: [],
  triangles: []
});

const appendEdgeTube = (mesh: MeshData, edge: Edge, nodes: Map<string, Node>, radiusM: number) => {
  const start = edge.renderStart ?? nodes.get(edge.nodeA)?.position;
  const end = edge.renderEnd ?? nodes.get(edge.nodeB)?.position;
  if (!start || !end) return;
  appendCylinder(mesh, start, end, radiusM, STRUT_SEGMENTS);
};

const appendCylinder = (mesh: MeshData, start: Vec3, end: Vec3, radiusM: number, segments: number) => {
  const axis = sub(end, start);
  const axisLength = length(axis);
  if (axisLength < 1e-8) return;

  const direction = normalize(axis);
  const tangentA = normalize(Math.abs(dot(direction, [0, 0, 1])) > 0.96 ? cross(direction, [0, 1, 0]) : cross(direction, [0, 0, 1]));
  const tangentB = normalize(cross(direction, tangentA));
  const ringStart: number[] = [];
  const ringEnd: number[] = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const radial = normalize(add(scale(tangentA, Math.cos(angle)), scale(tangentB, Math.sin(angle))));
    ringStart.push(pushVertex(mesh, add(start, scale(radial, radiusM)), radial));
    ringEnd.push(pushVertex(mesh, add(end, scale(radial, radiusM)), radial));
  }

  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    pushTriangle(mesh, ringStart[index], ringEnd[index], ringEnd[next]);
    pushTriangle(mesh, ringStart[index], ringEnd[next], ringStart[next]);
  }
};

const appendRing = (mesh: MeshData, node: Node) => {
  if (!node.ring) return;
  const majorRadiusM = node.ring.diameterM / 2;
  const minorRadiusM = Math.max(0.001, node.ring.tubeDiameterM / 2);
  const center = node.ring.center;
  const normal = normalize(node.ring.normal);
  const tangentX = normalize(node.ring.tangentX);
  const tangentY = normalize(node.ring.tangentY);
  const indices: number[][] = [];

  for (let ringIndex = 0; ringIndex < RING_SEGMENTS; ringIndex += 1) {
    const theta = (ringIndex / RING_SEGMENTS) * Math.PI * 2;
    const radial = normalize(add(scale(tangentX, Math.cos(theta)), scale(tangentY, Math.sin(theta))));
    const row: number[] = [];

    for (let tubeIndex = 0; tubeIndex < RING_TUBE_SEGMENTS; tubeIndex += 1) {
      const phi = (tubeIndex / RING_TUBE_SEGMENTS) * Math.PI * 2;
      const vertexNormal = normalize(add(scale(radial, Math.cos(phi)), scale(normal, Math.sin(phi))));
      const position = add(center, add(scale(radial, majorRadiusM + minorRadiusM * Math.cos(phi)), scale(normal, minorRadiusM * Math.sin(phi))));
      row.push(pushVertex(mesh, position, vertexNormal));
    }
    indices.push(row);
  }

  for (let ringIndex = 0; ringIndex < RING_SEGMENTS; ringIndex += 1) {
    const nextRing = (ringIndex + 1) % RING_SEGMENTS;
    for (let tubeIndex = 0; tubeIndex < RING_TUBE_SEGMENTS; tubeIndex += 1) {
      const nextTube = (tubeIndex + 1) % RING_TUBE_SEGMENTS;
      pushTriangle(mesh, indices[ringIndex][tubeIndex], indices[nextRing][tubeIndex], indices[nextRing][nextTube]);
      pushTriangle(mesh, indices[ringIndex][tubeIndex], indices[nextRing][nextTube], indices[ringIndex][nextTube]);
    }
  }
};

const appendSphere = (mesh: MeshData, center: Vec3, radiusM: number) => {
  const indices: number[][] = [];
  for (let y = 0; y <= NODE_SPHERE_HEIGHT_SEGMENTS; y += 1) {
    const v = y / NODE_SPHERE_HEIGHT_SEGMENTS;
    const phi = v * Math.PI;
    const row: number[] = [];
    for (let x = 0; x < NODE_SPHERE_WIDTH_SEGMENTS; x += 1) {
      const u = x / NODE_SPHERE_WIDTH_SEGMENTS;
      const theta = u * Math.PI * 2;
      const normal: Vec3 = [Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
      row.push(pushVertex(mesh, add(center, scale(normal, radiusM)), normal));
    }
    indices.push(row);
  }

  for (let y = 0; y < NODE_SPHERE_HEIGHT_SEGMENTS; y += 1) {
    for (let x = 0; x < NODE_SPHERE_WIDTH_SEGMENTS; x += 1) {
      const nextX = (x + 1) % NODE_SPHERE_WIDTH_SEGMENTS;
      if (y > 0) pushTriangle(mesh, indices[y][x], indices[y + 1][x], indices[y][nextX]);
      if (y < NODE_SPHERE_HEIGHT_SEGMENTS - 1) {
        pushTriangle(mesh, indices[y][nextX], indices[y + 1][x], indices[y + 1][nextX]);
      }
    }
  }
};

const pushVertex = (mesh: MeshData, position: Vec3, normal: Vec3): number => {
  const index = mesh.positions.length / 3;
  mesh.positions.push(...position);
  mesh.normals.push(...normalize(normal));
  return index;
};

const pushTriangle = (mesh: MeshData, a: number, b: number, c: number) => {
  mesh.triangles.push(a, b, c);
};

const createAssetXml = (created: string, state: ProjectState): string => `
  <asset>
    <contributor>
      <authoring_tool>DomeLab SketchUp COLLADA exporter</authoring_tool>
      <comments>${escapeXml(configurationSummaryLine(state))}</comments>
    </contributor>
    <created>${created}</created>
    <modified>${created}</modified>
    <unit name="meter" meter="1"/>
    <up_axis>Z_UP</up_axis>
  </asset>`;

const createEffectsXml = (materials: MaterialEntry[]): string => `
  <library_effects>
${materials.map(createEffectXml).join("\n")}
  </library_effects>`;

const createEffectXml = (material: MaterialEntry): string => {
  const color = hexToColor(material.color, material.opacity);
  return `    <effect id="${material.id}_effect" name="${escapeXml(material.name)}">
      <profile_COMMON>
        <technique sid="common">
          <phong>
            <diffuse><color>${color}</color></diffuse>
            <specular><color>0.35 0.35 0.35 1</color></specular>
            <shininess><float>32</float></shininess>
          </phong>
        </technique>
      </profile_COMMON>
    </effect>`;
};

const createMaterialsXml = (materials: MaterialEntry[]): string => `
  <library_materials>
${materials
  .map(
    (material) => `    <material id="${material.id}" name="${escapeXml(material.name)}">
      <instance_effect url="#${material.id}_effect"/>
    </material>`
  )
  .join("\n")}
  </library_materials>`;

const createGeometriesXml = (geometries: GeometryEntry[]): string => `
  <library_geometries>
${geometries.map(createGeometryXml).join("\n")}
  </library_geometries>`;

const createGeometryXml = (entry: GeometryEntry): string => {
  const positionCount = entry.mesh.positions.length / 3;
  const normalCount = entry.mesh.normals.length / 3;
  return `    <geometry id="${entry.id}" name="${escapeXml(entry.name)}">
      <mesh>
        <source id="${entry.id}_positions">
          <float_array id="${entry.id}_positions_array" count="${entry.mesh.positions.length}">${formatFloats(entry.mesh.positions)}</float_array>
          <technique_common>
            <accessor source="#${entry.id}_positions_array" count="${positionCount}" stride="3">
              <param name="X" type="float"/>
              <param name="Y" type="float"/>
              <param name="Z" type="float"/>
            </accessor>
          </technique_common>
        </source>
        <source id="${entry.id}_normals">
          <float_array id="${entry.id}_normals_array" count="${entry.mesh.normals.length}">${formatFloats(entry.mesh.normals)}</float_array>
          <technique_common>
            <accessor source="#${entry.id}_normals_array" count="${normalCount}" stride="3">
              <param name="X" type="float"/>
              <param name="Y" type="float"/>
              <param name="Z" type="float"/>
            </accessor>
          </technique_common>
        </source>
        <vertices id="${entry.id}_vertices">
          <input semantic="POSITION" source="#${entry.id}_positions"/>
        </vertices>
        <triangles material="${entry.materialSymbol}" count="${entry.mesh.triangles.length / 3}">
          <input semantic="VERTEX" source="#${entry.id}_vertices" offset="0"/>
          <input semantic="NORMAL" source="#${entry.id}_normals" offset="1"/>
          <p>${formatTriangleIndices(entry.mesh.triangles)}</p>
        </triangles>
      </mesh>
    </geometry>`;
};

const createSceneXml = (geometries: GeometryEntry[], state: ProjectState): string => `
  <library_visual_scenes>
    <visual_scene id="domelab_scene" name="DomeLab">
      <node id="domelab_model" name="${escapeXml(configurationSummaryLine(state))}">
        <extra>
          <technique profile="DomeLab">
            <surface>${escapeXml(surfaceKindLabel(state.surface.kind))}</surface>
            <pattern>${escapeXml(patternKindLabel(state.pattern.kind))}</pattern>
            <node_treatment>${escapeXml(state.nodes.kind)}</node_treatment>
          </technique>
        </extra>
${geometries.map(createGeometryNodeXml).join("\n")}
      </node>
    </visual_scene>
  </library_visual_scenes>
  <scene>
    <instance_visual_scene url="#domelab_scene"/>
  </scene>`;

const createGeometryNodeXml = (entry: GeometryEntry): string => `        <node id="${safeId(`${entry.id}_node`)}" name="${escapeXml(entry.name)}">
          <instance_geometry url="#${entry.id}">
            <bind_material>
              <technique_common>
                <instance_material symbol="${entry.materialSymbol}" target="#${entry.materialId}"/>
              </technique_common>
            </bind_material>
          </instance_geometry>
        </node>`;

const formatTriangleIndices = (indices: number[]): string => indices.map((index) => `${index} ${index}`).join(" ");

const formatFloats = (values: number[]): string => values.map(formatFloat).join(" ");

const formatFloat = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.abs(value) < 1e-9 ? 0 : value;
  return Number(rounded.toFixed(6)).toString();
};

const formatMeters = (value: number): string => `${Number(value.toFixed(3))} m`;

const hexToColor = (hex: string, opacity: number): string => {
  const clean = hex.replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;
  return `${formatFloat(red)} ${formatFloat(green)} ${formatFloat(blue)} ${formatFloat(opacity)}`;
};

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const safeId = (value: string): string => {
  const sanitized = value.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[A-Za-z_]/.test(sanitized) ? sanitized : `id_${sanitized}`;
};
