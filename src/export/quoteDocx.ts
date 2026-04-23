import type { BuiltProject, ProjectState, ShapeMode, StructurePattern } from "../types";
import { metersToDisplay, number as formatNumber } from "../utils/format";
import { measureAsync } from "../utils/debug";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TEXT_ENCODER = new TextEncoder();
const PAGE_WIDTH_TWIPS = 9360;
const CRC_TABLE = createCrcTable();

export type QuoteViewName = "isometric" | "elevation" | "plan";
export type QuoteProjectionMode = "perspective" | "axonometric";

export interface QuoteViewOption {
  view: QuoteViewName;
  include: boolean;
  projection: QuoteProjectionMode;
  frontHemisphereOnly: boolean;
}

export const defaultQuoteViewOptions: QuoteViewOption[] = [
  { view: "isometric", include: true, projection: "perspective", frontHemisphereOnly: false },
  { view: "elevation", include: true, projection: "axonometric", frontHemisphereOnly: false },
  { view: "plan", include: true, projection: "axonometric", frontHemisphereOnly: false }
];

interface QuotePreviewImage {
  bytes: Uint8Array;
  widthPx: number;
  heightPx: number;
  relationshipId: string;
  filename: string;
  title: string;
  docPrId: number;
}

interface QuoteLineItem {
  item: string;
  description: string;
  quantity: string;
  nominalLength: string;
}

interface QuoteDocumentImage {
  widthPx: number;
  heightPx: number;
  relationshipId: string;
  title: string;
  docPrId: number;
  filename: string;
}

interface PreviewPoint {
  id: string;
  x: number;
  y: number;
  depth: number;
}

interface PreviewSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number;
}

interface PreviewProjection {
  points: PreviewPoint[];
  segments: PreviewSegment[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export const createQuoteDocx = async (built: BuiltProject, state: ProjectState): Promise<Blob> => {
  return measureAsync(
    "export",
    "quote-docx-default",
    async () => {
      const images = await createQuotePreviewImages(built, defaultQuoteViewOptions);
      const files: ZipEntry[] = [
        { name: "[Content_Types].xml", data: encodeXml(createContentTypesXml()) },
        { name: "_rels/.rels", data: encodeXml(createPackageRelationshipsXml()) },
        { name: "docProps/app.xml", data: encodeXml(createAppPropsXml()) },
        { name: "docProps/core.xml", data: encodeXml(createCorePropsXml()) },
        {
          name: "word/document.xml",
          data: encodeXml(
            createQuoteDocumentXml({
              built,
              state,
              images: images.map((image) => ({
                widthPx: image.widthPx,
                heightPx: image.heightPx,
                relationshipId: image.relationshipId,
                title: image.title,
                docPrId: image.docPrId,
                filename: image.filename
              }))
            })
          )
        },
        {
          name: "word/_rels/document.xml.rels",
          data: encodeXml(createDocumentRelationshipsXml(images))
        },
        ...images.map((image) => ({ name: `word/media/${image.filename}`, data: image.bytes }))
      ];

      return new Blob([createZipArchive(files)], { type: DOCX_MIME });
    },
    {
      nodeCount: built.geometry.nodes.length,
      edgeCount: built.geometry.edges.length,
      selectedViews: defaultQuoteViewOptions.filter((option) => option.include).length
    }
  );
};

export const createQuoteDocxWithViews = async (
  built: BuiltProject,
  state: ProjectState,
  viewOptions: QuoteViewOption[]
): Promise<Blob> => {
  return measureAsync(
    "export",
    "quote-docx",
    async () => {
      const images = await createQuotePreviewImages(built, viewOptions);
      const files: ZipEntry[] = [
        { name: "[Content_Types].xml", data: encodeXml(createContentTypesXml()) },
        { name: "_rels/.rels", data: encodeXml(createPackageRelationshipsXml()) },
        { name: "docProps/app.xml", data: encodeXml(createAppPropsXml()) },
        { name: "docProps/core.xml", data: encodeXml(createCorePropsXml()) },
        {
          name: "word/document.xml",
          data: encodeXml(
            createQuoteDocumentXml({
              built,
              state,
              images: images.map((image) => ({
                widthPx: image.widthPx,
                heightPx: image.heightPx,
                relationshipId: image.relationshipId,
                title: image.title,
                docPrId: image.docPrId,
                filename: image.filename
              }))
            })
          )
        },
        {
          name: "word/_rels/document.xml.rels",
          data: encodeXml(createDocumentRelationshipsXml(images))
        },
        ...images.map((image) => ({ name: `word/media/${image.filename}`, data: image.bytes }))
      ];

      return new Blob([createZipArchive(files)], { type: DOCX_MIME });
    },
    {
      nodeCount: built.geometry.nodes.length,
      edgeCount: built.geometry.edges.length,
      selectedViews: viewOptions.filter((option) => option.include).length
    }
  );
};

export const createQuoteLineItems = (built: BuiltProject, state: ProjectState): QuoteLineItem[] => [
  ...built.bom.strutGroups.map((group) => ({
    item: group.label,
    description: `Strut group ${group.label}`,
    quantity: formatNumber(group.quantity),
    nominalLength: metersToDisplay(group.modelLengthM, state.project.units)
  })),
  ...built.bom.nodeGroups.map((group) => ({
    item: group.label,
    description: `Node/connector group, valence ${group.valence}, ${roleLabel(group.role)}`,
    quantity: formatNumber(group.quantity),
    nominalLength: ""
  }))
];

export const createQuoteDocumentXml = ({
  built,
  state,
  images
}: {
  built: BuiltProject;
  state: ProjectState;
  images: QuoteDocumentImage[];
}): string => {
  const lineItems = createQuoteLineItems(built, state);
  const title = createParagraph("Sphere Frame Quote Request", {
    bold: true,
    fontSizeHalfPoints: 30,
    spacingAfterTwips: 160
  });
  const intro = createParagraph(
    "Please quote the sphere frame shown below. This package keeps the request simple and excludes fabrication-specific cut and end-processing details.",
    { spacingAfterTwips: 200 }
  );
  const geometrySection = [
    createSectionHeading("Sphere size and geometry"),
    ...createGeometrySummary(built, state).map((line, index, lines) =>
      createParagraph(line, { spacingAfterTwips: index === lines.length - 1 ? 180 : 80 })
    )
  ].join("");
  const materialSection = [
    createSectionHeading("Material and surface finish"),
    createTable(
      [
        ["Material", "[type in later]"],
        ["Surface finish", "[type in later]"]
      ],
      [2400, PAGE_WIDTH_TWIPS - 2400]
    )
  ].join("");
  const imageSection = [
    createSectionHeading("Reference views"),
    ...(images.length > 0
      ? images.flatMap((image, index) => [
          createParagraph(image.title, {
            bold: true,
            spacingAfterTwips: 80,
            spacingBeforeTwips: index === 0 ? 0 : 140
          }),
          createImageParagraph(image),
          createParagraph("", { spacingAfterTwips: 80 })
        ])
      : [createParagraph("No reference views selected.", { spacingAfterTwips: 120 })])
  ].join("");
  const bomSection = [
    createSectionHeading("BOM"),
    createTable(
      [
        ["Item", "Description", "Qty", "Nominal strut length"],
        ...lineItems.map((item) => [item.item, item.description, item.quantity, item.nominalLength])
      ],
      [1200, 4380, 960, PAGE_WIDTH_TWIPS - 1200 - 4380 - 960],
      true
    )
  ].join("");
  const shippingSection = [
    createSectionHeading("Packing and commercial requirements"),
    createParagraph("All items to be palletized.", { spacingAfterTwips: 80 }),
    createParagraph("Please provide pricing on an EXW basis.", { spacingAfterTwips: 80 }),
    createParagraph("Please include packed weight and pallet dimensions for shipping.", { spacingAfterTwips: 80 })
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
>
  <w:body>
    ${title}
    ${intro}
    ${geometrySection}
    ${materialSection}
    ${imageSection}
    ${bomSection}
    ${shippingSection}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840" />
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0" />
    </w:sectPr>
  </w:body>
</w:document>`;
};

const createGeometrySummary = (built: BuiltProject, state: ProjectState): string[] => {
  const coverage = resolveSphereCoverage(state);
  const radiusM = state.geometry.diameterM / 2;
  const overallHeightM = state.geometry.capHeightM ?? state.geometry.diameterM * coverage;
  return [
    `Sphere size: ${metersToDisplay(state.geometry.diameterM, state.project.units)} diameter, ${metersToDisplay(radiusM, state.project.units)} radius, ${metersToDisplay(overallHeightM, state.project.units)} overall height.`,
    `Geometry: ${patternLabel(state.geometry.pattern)} ${geometryDetailLabel(state)} configured as a ${shapeLabel(state.geometry.shape)} (${formatNumber(coverage * 100, 1)}% sphere coverage).`,
    `Scope quantities: ${formatNumber(built.geometry.nodes.length)} nodes, ${formatNumber(built.geometry.edges.length)} struts, ${formatNumber(built.bom.strutGroups.length)} nominal strut groups.`,
    "Selected reference views and the BOM are included below for quoting. Fabrication operations, cut lengths, and end treatments are intentionally excluded."
  ];
};

const createQuotePreviewImages = async (
  built: BuiltProject,
  viewOptions: QuoteViewOption[]
): Promise<QuotePreviewImage[]> => {
  const selectedViews = viewOptions.filter((option) => option.include);
  return Promise.all(
    selectedViews.map((option, index) => createQuotePreviewImage(built, option, index))
  );
};

const createQuotePreviewImage = async (
  built: BuiltProject,
  option: QuoteViewOption,
  index: number
): Promise<QuotePreviewImage> =>
  measureAsync(
    "export",
    "quote-preview-image",
    async () => {
      const widthPx = 960;
      const heightPx = 720;
      const canvas = document.createElement("canvas");
      canvas.width = widthPx;
      canvas.height = heightPx;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas 2D context is not available for DOCX preview generation.");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, widthPx, heightPx);

      if (built.geometry.nodes.length === 0 || built.geometry.edges.length === 0) {
        context.fillStyle = "#111827";
        context.font = "24px sans-serif";
        context.fillText("No geometry available", 72, heightPx / 2);
      } else {
        const projection = projectForPreview(built, option);
        const padding = 84;
        const scale = Math.min(
          (widthPx - padding * 2) / Math.max(1, projection.maxX - projection.minX),
          (heightPx - padding * 2) / Math.max(1, projection.maxY - projection.minY)
        );
        const points = new Map(
          projection.points.map((point) => [
            point.id,
            {
              x: padding + (point.x - projection.minX) * scale,
              y: heightPx - padding - (point.y - projection.minY) * scale,
              depth: point.depth
            }
          ])
        );
        const segments = projection.segments.map((segment) => ({
          ...segment,
          startX: padding + (segment.x1 - projection.minX) * scale,
          startY: heightPx - padding - (segment.y1 - projection.minY) * scale,
          endX: padding + (segment.x2 - projection.minX) * scale,
          endY: heightPx - padding - (segment.y2 - projection.minY) * scale
        }));
        const minDepth = Math.min(...segments.map((segment) => segment.depth));
        const maxDepth = Math.max(...segments.map((segment) => segment.depth));

        segments
          .sort((left, right) => right.depth - left.depth)
          .forEach(({ startX, startY, endX, endY, depth }) => {
            const normalizedDepth = (depth - minDepth) / Math.max(1e-6, maxDepth - minDepth);
            context.beginPath();
            context.moveTo(startX, startY);
            context.lineTo(endX, endY);
            context.lineWidth = 2.1 - normalizedDepth * 0.6;
            context.strokeStyle = "#0f766e";
            context.globalAlpha = 0.64 - normalizedDepth * 0.26;
            context.stroke();
          });

        context.globalAlpha = 1;
        built.geometry.nodes.forEach((node) => {
          const point = points.get(node.id);
          if (!point) return;
          context.beginPath();
          context.arc(point.x, point.y, 2.7, 0, Math.PI * 2);
          context.fillStyle = "#0f172a";
          context.fill();
        });
      }

      const bytes = await canvasToPngBytes(canvas);
      return {
        bytes,
        widthPx,
        heightPx,
        relationshipId: `rId${index + 1}`,
        filename: `${option.view}-${option.projection}${option.frontHemisphereOnly ? "-front" : ""}.png`,
        title: `${viewLabel(option.view)} (${projectionLabel(option.projection)}${option.frontHemisphereOnly ? ", Front hemisphere only" : ""})`,
        docPrId: index + 1
      };
    },
    {
      view: option.view,
      projection: option.projection,
      frontHemisphereOnly: option.frontHemisphereOnly
    }
  );

const projectForPreview = (built: BuiltProject, option: QuoteViewOption): PreviewProjection => {
  const radius = modelRadius(built);
  const { forward, upReference } = viewBasis(option.view);
  const right = normalize(cross(forward, upReference));
  const up = normalize(cross(right, forward));
  const cameraDistance = Math.max(6, radius * 4.3);
  const cameraPosition = scaleVector(forward, -cameraDistance);
  const focalLength = cameraDistance * 0.92;
  const nodeMap = new Map(built.geometry.nodes.map((node) => [node.id, node.position]));
  const projectPoint = (position: [number, number, number]) => {
    const relative = subtract(position, cameraPosition);
    const depth = dot(relative, forward);
    const xBase =
      option.projection === "perspective" ? (dot(relative, right) * focalLength) / Math.max(0.25, depth) : dot(position, right);
    const yBase =
      option.projection === "perspective" ? (dot(relative, up) * focalLength) / Math.max(0.25, depth) : dot(position, up);
    return {
      x: xBase,
      y: yBase,
      depth
    };
  };

  const points = built.geometry.nodes
    .filter((node) => !option.frontHemisphereOnly || isFrontHemispherePoint(node.position, forward))
    .map((node) => {
      const projected = projectPoint(node.position);
      return {
        id: node.id,
        x: projected.x,
        y: projected.y,
        depth: projected.depth
      };
    });

  const segments = built.geometry.edges.flatMap((edge) => {
    const start = nodeMap.get(edge.nodeA);
    const end = nodeMap.get(edge.nodeB);
    if (!start || !end) return [];
    const clipped =
      option.frontHemisphereOnly ? clipSegmentToFrontHemisphere(start, end, forward) : { start, end };
    if (!clipped) return [];
    const projectedStart = projectPoint(clipped.start);
    const projectedEnd = projectPoint(clipped.end);
    return [
      {
        x1: projectedStart.x,
        y1: projectedStart.y,
        x2: projectedEnd.x,
        y2: projectedEnd.y,
        depth: (projectedStart.depth + projectedEnd.depth) / 2
      }
    ];
  });
  const boundsX = [...points.map((point) => point.x), ...segments.flatMap((segment) => [segment.x1, segment.x2])];
  const boundsY = [...points.map((point) => point.y), ...segments.flatMap((segment) => [segment.y1, segment.y2])];
  return {
    points,
    segments,
    minX: Math.min(...boundsX, -1),
    maxX: Math.max(...boundsX, 1),
    minY: Math.min(...boundsY, -1),
    maxY: Math.max(...boundsY, 1)
  };
};

const viewBasis = (view: QuoteViewName): { forward: [number, number, number]; upReference: [number, number, number] } => {
  if (view === "plan") {
    return { forward: [0, 0, -1], upReference: [0, 1, 0] };
  }
  if (view === "elevation") {
    return { forward: normalize([0, 1, -0.12]), upReference: [0, 0, 1] };
  }
  return { forward: normalize([-0.62, 0.82, -0.58]), upReference: [0, 0, 1] };
};

const canvasToPngBytes = async (canvas: HTMLCanvasElement): Promise<Uint8Array> => {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) {
        resolve(value);
        return;
      }
      reject(new Error("PNG export failed."));
    }, "image/png");
  });

  return new Uint8Array(await blob.arrayBuffer());
};

const createContentTypesXml = (): string => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Default Extension="png" ContentType="image/png" />
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml" />
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml" />
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" />
</Types>`;

const createPackageRelationshipsXml = (): string => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml" />
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml" />
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml" />
</Relationships>`;

const createDocumentRelationshipsXml = (images: Array<{ relationshipId: string; filename: string }>): string => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${images
    .map(
      (image) =>
        `<Relationship Id="${escapeXml(image.relationshipId)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${escapeXml(image.filename)}" />`
    )
    .join("")}
</Relationships>`;

const createAppPropsXml = (): string => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties
  xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"
>
  <Application>Dome Lab</Application>
</Properties>`;

const createCorePropsXml = (): string => {
  const timestamp = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties
  xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
>
  <dc:title>Sphere Frame Quote Request</dc:title>
  <dc:creator>Dome Lab</dc:creator>
  <cp:lastModifiedBy>Dome Lab</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>
</cp:coreProperties>`;
};

const createSectionHeading = (text: string): string =>
  createParagraph(text, { bold: true, fontSizeHalfPoints: 24, spacingBeforeTwips: 220, spacingAfterTwips: 120 });

const createParagraph = (
  text: string,
  options: {
    bold?: boolean;
    fontSizeHalfPoints?: number;
    spacingBeforeTwips?: number;
    spacingAfterTwips?: number;
  } = {}
): string => {
  const paragraphProperties = [];
  if (options.spacingBeforeTwips !== undefined || options.spacingAfterTwips !== undefined) {
    paragraphProperties.push(
      `<w:spacing w:before="${options.spacingBeforeTwips ?? 0}" w:after="${options.spacingAfterTwips ?? 0}" />`
    );
  }
  const runProperties = [];
  if (options.bold) runProperties.push("<w:b />");
  if (options.fontSizeHalfPoints !== undefined) {
    runProperties.push(`<w:sz w:val="${options.fontSizeHalfPoints}" />`);
    runProperties.push(`<w:szCs w:val="${options.fontSizeHalfPoints}" />`);
  }
  return `<w:p>${
    paragraphProperties.length ? `<w:pPr>${paragraphProperties.join("")}</w:pPr>` : ""
  }<w:r>${runProperties.length ? `<w:rPr>${runProperties.join("")}</w:rPr>` : ""}${createTextNode(text)}</w:r></w:p>`;
};

const createTextNode = (text: string): string =>
  text === "" ? "<w:t xml:space=\"preserve\"> </w:t>" : `<w:t xml:space="preserve">${escapeXml(text)}</w:t>`;

const createTable = (rows: string[][], columnWidths: number[], headerRow = false): string => `\
<w:tbl>
  <w:tblPr>
    <w:tblW w:w="${columnWidths.reduce((sum, width) => sum + width, 0)}" w:type="dxa" />
    <w:tblLayout w:type="fixed" />
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="D9E2EC" />
      <w:left w:val="single" w:sz="4" w:space="0" w:color="D9E2EC" />
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D9E2EC" />
      <w:right w:val="single" w:sz="4" w:space="0" w:color="D9E2EC" />
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9E2EC" />
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9E2EC" />
    </w:tblBorders>
  </w:tblPr>
  <w:tblGrid>${columnWidths.map((width) => `<w:gridCol w:w="${width}" />`).join("")}</w:tblGrid>
  ${rows
    .map(
      (row, rowIndex) => `<w:tr>${row
        .map((cell, cellIndex) => {
          const width = columnWidths[Math.min(cellIndex, columnWidths.length - 1)];
          return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa" /></w:tcPr>${createParagraph(cell, {
            bold: headerRow && rowIndex === 0,
            spacingAfterTwips: 0
          })}</w:tc>`;
        })
        .join("")}</w:tr>`
    )
    .join("")}
</w:tbl>`;

const createImageParagraph = (image: QuoteDocumentImage): string => {
  const maxWidthEmu = 5.8 * 914400;
  const widthEmu = Math.round(maxWidthEmu);
  const heightEmu = Math.round((image.heightPx / Math.max(1, image.widthPx)) * widthEmu);

  return `<w:p>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="${widthEmu}" cy="${heightEmu}" />
        <wp:effectExtent l="0" t="0" r="0" b="0" />
        <wp:docPr id="${image.docPrId}" name="${escapeXml(image.title)}" />
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks noChangeAspect="1" />
        </wp:cNvGraphicFramePr>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic>
              <pic:nvPicPr>
                <pic:cNvPr id="${image.docPrId}" name="${escapeXml(image.filename)}" />
                <pic:cNvPicPr />
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${escapeXml(image.relationshipId)}" />
                <a:stretch><a:fillRect /></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm>
                  <a:off x="0" y="0" />
                  <a:ext cx="${widthEmu}" cy="${heightEmu}" />
                </a:xfrm>
                <a:prstGeom prst="rect"><a:avLst /></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>`;
};

const createZipArchive = (entries: ZipEntry[]): Uint8Array => {
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  const timestamp = createDosTimestamp(new Date());
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = TEXT_ENCODER.encode(entry.name);
    const crc = crc32(entry.data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, timestamp.time, true);
    localView.setUint16(12, timestamp.date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    chunks.push(localHeader, entry.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, timestamp.time, true);
    centralView.setUint16(14, timestamp.date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralDirectory.push(centralHeader);

    offset += localHeader.length + entry.data.length;
  });

  const centralOffset = offset;
  const centralBytes = concatenate(centralDirectory);
  chunks.push(centralBytes);
  offset += centralBytes.length;

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralBytes.length, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);
  chunks.push(endRecord);

  return concatenate(chunks);
};

const encodeXml = (value: string): Uint8Array => TEXT_ENCODER.encode(value);

const concatenate = (chunks: Uint8Array[]): Uint8Array => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const buffer = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    buffer.set(chunk, offset);
    offset += chunk.length;
  });
  return buffer;
};

const createDosTimestamp = (date: Date): { date: number; time: number } => {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  };
};

const crc32 = (bytes: Uint8Array): number => {
  let value = 0xffffffff;
  bytes.forEach((byte) => {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  });
  return (value ^ 0xffffffff) >>> 0;
};

function createCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const resolveSphereCoverage = (state: ProjectState): number => {
  if (state.geometry.sphereCoverage !== undefined) {
    return clamp(state.geometry.sphereCoverage, 0.5, 1);
  }
  if (state.geometry.shape === "full-sphere") return 1;
  if (state.geometry.shape === "hemisphere") return 0.5;
  if (state.geometry.capHeightM !== undefined) {
    return clamp(state.geometry.capHeightM / state.geometry.diameterM, 0.5, 1);
  }
  return 1;
};

const patternLabel = (pattern: StructurePattern): string => {
  if (pattern === "geodesic") return "Geodesic";
  if (pattern === "lamella") return "Lamella";
  return "Ribbed rectangular";
};

const geometryDetailLabel = (state: ProjectState): string => {
  if (state.geometry.pattern === "geodesic") return `${state.geodesic.frequency}V`;
  if (state.geometry.pattern === "lamella") {
    return `${state.lamella.sectors} sectors x ${state.lamella.rings} rings`;
  }
  return `${state.ribbedRectangular.ribs} ribs x ${state.ribbedRectangular.rings} rings`;
};

const shapeLabel = (shape: ShapeMode): string => {
  if (shape === "full-sphere") return "full sphere";
  if (shape === "hemisphere") return "hemisphere";
  if (shape === "flattened-base") return "spherical cap with flat base";
  if (shape === "sphere-segment") return "sphere segment";
  return "spherical cap";
};

const roleLabel = (value: string): string =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const dot = (a: [number, number, number], b: [number, number, number]): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];

const normalize = (value: [number, number, number]): [number, number, number] => {
  const length = Math.hypot(value[0], value[1], value[2]) || 1;
  return [value[0] / length, value[1] / length, value[2] / length];
};

const subtract = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2]
];

const scaleVector = (value: [number, number, number], scalar: number): [number, number, number] => [
  value[0] * scalar,
  value[1] * scalar,
  value[2] * scalar
];

const interpolateVector = (
  start: [number, number, number],
  end: [number, number, number],
  t: number
): [number, number, number] => [
  start[0] + (end[0] - start[0]) * t,
  start[1] + (end[1] - start[1]) * t,
  start[2] + (end[2] - start[2]) * t
];

const isFrontHemispherePoint = (position: [number, number, number], forward: [number, number, number]): boolean =>
  dot(position, forward) <= 1e-6;

const clipSegmentToFrontHemisphere = (
  start: [number, number, number],
  end: [number, number, number],
  forward: [number, number, number]
): { start: [number, number, number]; end: [number, number, number] } | null => {
  const startDistance = dot(start, forward);
  const endDistance = dot(end, forward);
  const startInside = startDistance <= 1e-6;
  const endInside = endDistance <= 1e-6;

  if (startInside && endInside) {
    return { start, end };
  }
  if (!startInside && !endInside) {
    return null;
  }

  const intersectionT = clamp(startDistance / (startDistance - endDistance), 0, 1);
  const intersection = interpolateVector(start, end, intersectionT);
  return startInside ? { start, end: intersection } : { start: intersection, end };
};

const modelRadius = (built: BuiltProject): number =>
  Math.max(1, ...built.geometry.nodes.map((node) => Math.hypot(...node.position)));

const viewLabel = (view: QuoteViewName): string => {
  if (view === "plan") return "Plan view";
  if (view === "elevation") return "Elevation view";
  return "Isometric view";
};

const projectionLabel = (projection: QuoteProjectionMode): string =>
  projection === "axonometric" ? "Axonometric" : "Perspective";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
