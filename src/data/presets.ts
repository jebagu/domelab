import { defaultProject } from "./defaultProject";
import type { ConnectorSystem, ProjectState, StructurePattern } from "../types";

// GBP/USD derived from ECB reference rates published on 2026-04-21:
// EUR/USD = 1.1767 and EUR/GBP = 0.87035, so GBP/USD = 1.351984833687597.
const PRESET_USD_RATES: Partial<Record<string, number>> = {
  USD: 1,
  GBP: 1.351984833687597
};

export interface ProjectPreset {
  id: string;
  name: string;
  location: string;
  note: string;
  state: ProjectState;
}

export const projectPresets: ProjectPreset[] = [
  preset(
    "KA1",
    "The Genesis Kugel, Osaka, Japan",
    "Inner visible lattice approximation of the Genesis Kugel modeled for Dome Lab as a 5/8 spherical cap on a 27 m inner sphere, derived from the historically correct two-layer MERO space frame with 30 m outer diameter, 27 m inner diameter, 1.5 m frame depth, 2.0 m visible inner struts, and 2.35 m outer struts.",
    {
      pattern: "geodesic",
      shape: "spherical-cap",
      sphereCoverage: 0.625,
      diameterM: 27,
      frequency: 8,
      connectorSystem: "ball-hub",
      materialName: "MERO space-frame steel",
      profileType: "custom",
      profileLabel: "MERO inner visible lattice, 2000 mm visible struts",
      strutDiameterMm: 60,
      reference: presetReference(
        "KA1 The Genesis Kugel, Osaka, Japan",
        "Inner visible lattice approximation of the Genesis Kugel modeled for Dome Lab as a 5/8 spherical cap on a 27 m inner sphere, derived from the historically correct two-layer MERO space frame with 30 m outer diameter, 27 m inner diameter, 1.5 m frame depth, 2.0 m visible inner struts, and 2.35 m outer struts.",
        [
          "Pattern: geodesic approximation.",
          "Shape: 5/8 spherical cap.",
          "Frequency: 8V.",
          "Connector: MERO ball hub.",
          "Known diameters: 30 m outer, 27 m inner."
        ]
      )
    }
  ),
  preset(
    "KA2",
    "Chateau du Feÿ, France",
    "Early small wooden prototype in the same geometry family later used for KA3 through KA6.",
    smallWoodPreset("KA2 Chateau du Feÿ, France", 2.8, false, "Early small wooden prototype in the same geometry family later used for KA3 through KA6.")
  ),
  preset(
    "KA3",
    "London, UK",
    "Small indoor wooden geodesic using the Build with Hubs kit, with two documented wood strut lengths.",
    smallWoodPreset("KA3 London, UK", 2.8, false, "Small indoor wooden geodesic using the Build with Hubs kit, with two documented wood strut lengths.")
  ),
  preset(
    "KA4",
    "Chinatown, UK",
    "Same small wooden geodesic geometry as KA3, deployed in Chinatown.",
    smallWoodPreset("KA4 Chinatown, UK", 4, false, "Same small wooden geodesic geometry as KA3, deployed in Chinatown.")
  ),
  preset(
    "KA5",
    "Hackney, UK",
    "KA3 geometry modified with an entrance opening and added base reinforcement.",
    smallWoodPreset(
      "KA5 Hackney, UK",
      2.8,
      true,
      "KA3 geometry modified with an entrance opening and added base reinforcement.",
      "KA3 family plus longer entrance and base members"
    )
  ),
  preset(
    "KA6",
    "Oxford, UK",
    "Touring continuation of the KA5 small wooden geodesic with entrance and base retained.",
    smallWoodPreset(
      "KA6 Oxford, UK",
      2.8,
      true,
      "Touring continuation of the KA5 small wooden geodesic with entrance and base retained.",
      "Same as KA5"
    )
  ),
  preset(
    "KA7",
    "San Pancho, Mexico",
    "First large steel 3V Sonic Sphere, around 7 meters in diameter, and the first major jump beyond the earlier wooden prototypes.",
    {
      pattern: "geodesic",
      shape: "sphere-segment",
      sphereCoverage: 0.875,
      bottomCutRatio: -0.75,
      topCutRatio: 1,
      diameterM: 7,
      frequency: 3,
      connectorSystem: "flattened-drilled-bolted",
      materialName: "Steel",
      profileType: "round tube",
      profileLabel: "Steel struts, dimensions unknown",
      strutDiameterMm: 33.7,
      reference: presetReference(
        "KA7 San Pancho, Mexico",
        "First large steel 3V Sonic Sphere, around 7 meters in diameter, and the first major jump beyond the earlier wooden prototypes.",
        ["Pattern: 3V geodesic.", "Shape: sphere segment approximation.", "Diameter: about 7 m."]
      )
    }
  ),
  preset(
    "KA8",
    "Chateau du Feÿ, France",
    "Refined full-sphere 3V steel Sonic Sphere at Chateau du Feÿ with reinforced struts, proper entrance, and base stabilizers.",
    {
      pattern: "geodesic",
      shape: "full-sphere",
      diameterM: 7.166739952475426,
      frequency: 3,
      connectorSystem: "flattened-drilled-bolted",
      currency: "GBP",
      lengthGroupToleranceMm: 1,
      materialName: "Galvanized steel",
      profileType: "round tube",
      profileLabel: "33.7 mm x 2.5 mm round tube, pressed ends",
      strutDiameterMm: 33.7,
      costPerMeter: 12.882701239789273,
      stockLengthM: 6,
      wasteFactor: 1,
      endOperationCostPerEnd: 0,
      nodeBaseCost: 0,
      nodePerStrutAdder: 0,
      setupCost: 0,
      contingencyPercent: 0,
      flattenedBolted: {
        holeDiameterMm: 12,
        holeOffsetMm: 20,
        flattenLengthMm: 50,
        flattenCompensationMm: 0,
        boltCost: 0,
        nutCost: 0,
        washerCost: 0
      },
      reference: feyReference()
    }
  ),
  preset(
    "KA9",
    "Black Rock Desert, USA",
    "Geodesic-inspired but non-geodesic sphere made from diagonally placed spirals held together by horizontal rings, with about 270 nodes.",
    burningManLamellaPreset(
      "KA9 Black Rock Desert, USA",
      "Geodesic-inspired but non-geodesic sphere made from diagonally placed spirals held together by horizontal rings, with about 270 nodes."
    )
  ),
  preset(
    "KA10",
    "Miami, USA",
    "Miami iteration continuing the spiral-ring non-geodesic structural language established in KA9.",
    burningManLamellaPreset(
      "KA10 Miami, USA",
      "Miami iteration continuing the spiral-ring non-geodesic structural language established in KA9.",
      "Uses the same reference cost package as KA9 Black Rock Desert, USA."
    )
  ),
  preset(
    "KA11",
    "New York, USA",
    "Large suspended New York Sonic Sphere at The Shed, about 20 meters in diameter, using a custom full-sphere lattice with 398 nodes, 124 speakers, and 12 subwoofers.",
    {
      pattern: "lamella",
      shape: "full-sphere",
      diameterM: 19.5072,
      sectors: 22,
      rings: 19,
      lamellaStyle: "alternating",
      handedness: "alternating",
      triangulation: "alternating",
      connectorSystem: "flattened-drilled-bolted",
      currency: "USD",
      materialName: "A36 steel or equivalent",
      profileType: "pipe",
      profileLabel: "2 NPS tube, 15 GA typical with 12 GA rows noted in schedule",
      strutDiameterMm: 60.3,
      costPerMeter: null,
      stockLengthM: null,
      wasteFactor: null,
      endOperationCostPerEnd: null,
      nodeBaseCost: null,
      nodePerStrutAdder: null,
      setupCost: null,
      contingencyPercent: null,
      flattenedBolted: {
        holeDiameterMm: 0,
        holeOffsetMm: 47,
        flattenLengthMm: 0,
        flattenCompensationMm: 0,
        boltCost: 0,
        nutCost: 0,
        washerCost: 0
      },
      reference: {
        sourceLabel: "S-500.00 Sphere General Arrangement",
        note: "Large suspended New York Sonic Sphere at The Shed, about 20 meters in diameter, using a custom full-sphere lattice with 398 nodes, 124 speakers, and 12 subwoofers. Drawing says fabrication should be based on digital files; do not use drawings for fabrication. The schedule below preserves drawing Type, sphere quantity, spare quantity, hole spacing, strut length, bend angle, and tube type.",
        knownParameters: [
          "Project: Sonic Sphere x The Shed, 545 W 30th St, New York, NY 10001.",
          "Sheet: S-500.00, Sphere General Arrangement, permit set dated 05.23.2023.",
          "Structure classification: full-sphere lamella/latitude-ring triangulated lattice, not a Class I frequency geodesic in Dome Lab's current taxonomy.",
          "Approximate overall diameter: 64 ft / 19.507 m from drawing scale/text.",
          "Layout basis in Dome Lab: 22 sectors and 19 rings to approximate 398 drawing nodes.",
          "Material note: all material grade A36, equivalent or better.",
          "Tube schedule: 2 NPS tube; 15 GA typical, with V7, H8, and V8 shown as 12 GA.",
          "Reference schedule totals: 1166 sphere members plus 80 spares, 1246 total ordered pieces."
        ],
        unknownParameters: [
          "Exact digital node coordinates and proprietary sphere model.",
          "Exact connector/hub hole diameter and hardware stack.",
          "Exact node cost, operation cost, supplier cost, and stock purchasing basis.",
          "Exact portal/opening geometry beyond the visible general arrangement.",
          "Whether all H/V/R members map one-to-one to the current Dome Lab lamella generator."
        ],
        parts: [
          shedPart("R1", 6, 1, 1656, 68.91, 4.7, "2NPS-15GA"),
          shedPart("H2", 6, 1, 1650, 68.7, 4.7, "2NPS-15GA"),
          shedPart("R2", 6, 1, 1441, 60.45, 4.1, "2NPS-15GA"),
          shedPart("V2", 12, 2, 1850, 76.58, 5.3, "2NPS-15GA"),
          shedPart("H3", 12, 2, 1579, 65.89, 4.5, "2NPS-15GA"),
          shedPart("R3", 12, 2, 1629, 67.85, 4.7, "2NPS-15GA"),
          shedPart("V3", 24, 2, 1897, 78.42, 5.4, "2NPS-15GA"),
          shedPart("H4", 24, 2, 1189, 50.55, 3.4, "2NPS-15GA"),
          shedPart("V4", 48, 2, 1800, 74.6, 5.2, "2NPS-15GA"),
          shedPart("H5", 24, 2, 1558, 65.09, 4.5, "2NPS-15GA"),
          shedPart("V5", 48, 2, 1800, 74.6, 5.2, "2NPS-15GA"),
          shedPart("H6", 24, 2, 1870, 77.34, 5.4, "2NPS-15GA"),
          shedPart("V6", 48, 2, 1950, 80.49, 5.6, "2NPS-15GA"),
          shedPart("H7", 24, 2, 2147, 88.25, 6.2, "2NPS-15GA"),
          shedPart("V7", 44, 2, 1950, 80.49, 5.6, "2NPS-12GA"),
          shedPart("H8", 20, 2, 2355, 96.47, 6.8, "2NPS-12GA"),
          shedPart("V8", 44, 2, 1950, 80.49, 5.6, "2NPS-12GA"),
          shedPart("H9", 22, 2, 2499, 102.12, 7.2, "2NPS-12GA"),
          shedPart("V9", 44, 2, 1950, 80.51, 5.6, "2NPS-15GA"),
          shedPart("H10", 20, 2, 2583, 105.43, 7.4, "2NPS-15GA"),
          shedPart("V10", 48, 2, 1950, 80.51, 5.6, "2NPS-15GA"),
          shedPart("H11", 24, 2, 2611, 106.51, 7.5, "2NPS-15GA"),
          shedPart("V11", 48, 2, 1950, 80.49, 5.6, "2NPS-15GA"),
          shedPart("H12", 24, 2, 2583, 105.42, 7.4, "2NPS-15GA"),
          shedPart("V12", 48, 2, 1950, 80.49, 5.6, "2NPS-15GA"),
          shedPart("H13", 24, 2, 2499, 102.12, 7.2, "2NPS-15GA"),
          shedPart("V13", 48, 2, 1950, 80.49, 5.6, "2NPS-15GA"),
          shedPart("H14", 24, 2, 2355, 96.45, 6.8, "2NPS-15GA"),
          shedPart("V14", 48, 2, 1950, 80.49, 5.6, "2NPS-15GA"),
          shedPart("H15", 24, 2, 2147, 88.25, 6.2, "2NPS-15GA"),
          shedPart("V15", 48, 2, 1950, 80.49, 5.6, "2NPS-15GA"),
          shedPart("H16", 24, 2, 1870, 77.34, 5.4, "2NPS-15GA"),
          shedPart("V16", 48, 2, 1800, 74.6, 5.2, "2NPS-15GA"),
          shedPart("H17", 24, 2, 1558, 65.09, 4.5, "2NPS-15GA"),
          shedPart("V17", 48, 2, 1800, 74.6, 5.2, "2NPS-15GA"),
          shedPart("H18", 24, 2, 1189, 50.55, 3.4, "2NPS-15GA"),
          shedPart("V18", 24, 2, 1897, 78.41, 5.4, "2NPS-15GA"),
          shedPart("R18", 12, 2, 1629, 67.85, 4.7, "2NPS-15GA"),
          shedPart("H19", 12, 2, 1579, 65.89, 4.5, "2NPS-15GA"),
          shedPart("V19", 12, 2, 1850, 76.58, 5.3, "2NPS-15GA"),
          shedPart("R19", 6, 1, 1441, 60.45, 4.1, "2NPS-15GA"),
          shedPart("H20", 6, 1, 1650, 68.69, 4.7, "2NPS-15GA"),
          shedPart("R20", 6, 1, 1656, 68.91, 4.7, "2NPS-15GA")
        ]
      }
    }
  )
];

export function cloneProjectState(state: ProjectState): ProjectState {
  return JSON.parse(JSON.stringify(state)) as ProjectState;
}

interface PresetOptions {
  pattern: StructurePattern;
  shape?: ProjectState["geometry"]["shape"];
  diameterM: number;
  sphereCoverage?: number;
  flatBase?: boolean;
  topCutRatio?: number;
  bottomCutRatio?: number;
  frequency?: ProjectState["geodesic"]["frequency"];
  sectors?: number;
  rings?: number;
  lamellaStyle?: ProjectState["lamella"]["style"];
  handedness?: ProjectState["lamella"]["handedness"];
  triangulation?: ProjectState["lamella"]["triangulation"];
  ribs?: number;
  diagonalBracing?: ProjectState["ribbedRectangular"]["diagonalBracing"];
  connectorSystem?: ConnectorSystem;
  currency?: string;
  lengthGroupToleranceMm?: number;
  materialName?: string;
  profileType?: ProjectState["material"]["profileType"];
  profileLabel?: string;
  strutDiameterMm: number;
  costPerMeter?: number | null;
  stockLengthM?: number | null;
  wasteFactor?: number | null;
  endOperationCostPerEnd?: number | null;
  nodeBaseCost?: number | null;
  nodePerStrutAdder?: number | null;
  setupCost?: number | null;
  contingencyPercent?: number | null;
  flattenedBolted?: Partial<ProjectState["connectors"]["flattenedBolted"]>;
  reference?: ProjectState["reference"];
}

function smallWoodPreset(
  sourceLabel: string,
  diameterM: number,
  flatBase: boolean,
  description: string,
  strutDimension = "1179 mm short / 1221 mm long"
): PresetOptions {
  return {
    pattern: "geodesic",
    shape: flatBase ? "flattened-base" : "spherical-cap",
    sphereCoverage: 0.625,
    flatBase,
    diameterM,
    frequency: 2,
    connectorSystem: "ball-hub",
    materialName: "Wood",
    profileType: "custom",
    profileLabel: strutDimension,
    strutDiameterMm: 38,
    reference: presetReference(sourceLabel, description, [
      "Pattern: 2V geodesic.",
      `Shape: ${flatBase ? "flattened-base partial sphere" : "partial sphere"} approximation.`,
      `Diameter: ${diameterM} m.`,
      `Strut dimension: ${strutDimension}.`,
      "Connector: Build with Hubs-style ball hub."
    ])
  };
}

function burningManLamellaPreset(sourceLabel: string, description: string, pricingNote?: string): PresetOptions {
  return {
    pattern: "lamella",
    shape: "full-sphere",
    diameterM: 12.5,
    sectors: 24,
    rings: 12,
    lamellaStyle: "curved",
    handedness: "alternating",
    triangulation: "alternating",
    connectorSystem: "welded-node",
    materialName: "Steel",
    profileType: "round tube",
    profileLabel: "Spiral-ring lattice struts, dimensions unknown",
    strutDiameterMm: 48,
    reference: burningManReference(sourceLabel, description, pricingNote)
  };
}

function feyReference(): ProjectState["reference"] {
  return {
    sourceLabel: "Christie parts list + lump-sum supplier invoice (normalized to USD)",
    note:
      "Updated cost reference normalized to USD from a GBP-denominated supplier invoice for an approximately 7 meter full sphere in 33.7 mm x 2.5 mm tube with pressed ends, holes, bolts, washers, and galvanized finish. The supplier invoiced the dome as a single ex-VAT amount of $7,361.56 plus $1,472.31 VAT, for $8,833.87 total. The line pricing below is a reconstructed allocation by cut length across the listed members and should be treated as internal reference costing rather than vendor-issued line items. Rows D-J remain feet and doorway pieces beyond the fitted 3V shell used in Dome Lab geometry.",
    knownParameters: [
      "Pattern: 3V geodesic full sphere approximation.",
      "Reference parts schedule total: 292 pieces and 422.659 m total cut length.",
      "Pricing basis normalized to USD at $17.4172 per meter ex VAT.",
      "Included scope in the normalized invoice: pressed both ends, 12 mm holes, M8 bolts and washers, galvanized finish, collection ready."
    ],
    unknownParameters: [
      "The original supplier invoice was issued as a lump sum and was not broken out by line item.",
      "The live Dome Lab shell geometry excludes the feet and doorway modifiers listed in rows D-J."
    ],
    pricingSummary: [
      "Normalized ex-VAT invoice total: $7,361.56.",
      "Normalized invoice total including VAT: $8,833.87.",
      "Pricing basis: 422.659 m total cut length at $17.4172 per meter ex VAT.",
      "Subtotals: primary sphere $6,847.84, feet $299.49, door assembly $214.22."
    ],
    parts: [
      pricedPart("A", "Pentagon radials", 55, 1289, 1249, convertGbpToUsd(16.61), convertGbpToUsd(913.32), {
        endAngleADeg: 10,
        endAngleBDeg: 10,
        color: "Yellow"
      }),
      pricedPart("B", "Pent/hex circumfs", 90, 1486, 1446, convertGbpToUsd(19.14), convertGbpToUsd(1722.94), {
        endAngleADeg: 12,
        endAngleBDeg: 12,
        color: "Blue"
      }),
      pricedPart("C", "Hexagon radials", 120, 1518, 1478, convertGbpToUsd(19.56), convertGbpToUsd(2346.71), {
        endAngleADeg: 12,
        endAngleBDeg: 12,
        color: "Red"
      }),
      pricedPart("D", "Flattened pentagon radials", 5, 1274, 1234, convertGbpToUsd(16.41), convertGbpToUsd(82.06), {
        endAngleADeg: 30,
        endAngleBDeg: 0,
        color: "Green"
      }),
      pricedPart("E", "Verticals for feet", 5, 595, 555, convertGbpToUsd(7.67), convertGbpToUsd(38.33), {
        endAngleADeg: 40,
        endAngleBDeg: 90,
        color: "White"
      }),
      pricedPart("F", "Horizontals for feet", 10, 1422, 1382, convertGbpToUsd(18.32), convertGbpToUsd(183.19), {
        endAngleADeg: 0,
        endAngleBDeg: 0,
        color: "Pink"
      }),
      pricedPart("G", "Doorway vertical", 2, 1699, 1659, convertGbpToUsd(21.89), convertGbpToUsd(43.78), {
        endAngleADeg: 70,
        endAngleBDeg: 0,
        color: "Black"
      }),
      pricedPart("H", "Doorway brace", 2, 2558, 2518, convertGbpToUsd(32.95), convertGbpToUsd(65.91), {
        endAngleADeg: 40,
        endAngleBDeg: 40,
        color: "Purple"
      }),
      pricedPart("I", "Doorway hex radial", 2, 1195, 1155, convertGbpToUsd(15.39), convertGbpToUsd(30.79), {
        endAngleADeg: 40,
        endAngleBDeg: 0,
        color: "Orange"
      }),
      pricedPart("J", "Doorway threshold", 1, 1395, 1355, convertGbpToUsd(17.97), convertGbpToUsd(17.97), {
        endAngleADeg: 0,
        endAngleBDeg: 0,
        color: "White"
      })
    ]
  };
}

function burningManReference(
  sourceLabel: string,
  description: string,
  pricingNote?: string
): ProjectState["reference"] {
  return {
    sourceLabel: `${sourceLabel} / strut layout drawing + Sales Quote SQ003249 (2022-07-08)`,
    note: `${description} Lamella geometry is retained in Dome Lab. The cost package below comes from the supplied strut layout drawing and Sales Quote SQ003249 dated 2022-07-08.${pricingNote ? ` ${pricingNote}` : ""} The supplier quote was not issued line-by-line by strut family, so the unit prices below are reconstructed allocations of the quoted total across the listed strut lines and should be treated as reference costing only.`,
    knownParameters: [
      "Pattern in Dome Lab: lamella spiral-ring approximation retained intentionally.",
      "Quoted strut package total: 645 pieces, including 562 pcs of 2.0 in 16 GA tube and 83 pcs of 2.0 in 11 GA tube.",
      "Total quoted cut length: about 1,132.789 m.",
      "Quote basis: material $13,644.58, cut/flatten/punch/bend $6,137.22, galvanizing $16,079.85, tooling $1,250.00."
    ],
    unknownParameters: [
      "Exact one-to-one mapping between the quoted H/V/R/D families and the current Dome Lab lamella generator.",
      "Any supplier-specific adjustments that were embedded in the lump-sum commercial quote rather than broken out by line."
    ],
    pricingSummary: [
      "Quoted total: $37,111.65 including $13,644.58 material, $6,137.22 cut/flatten/punch/bend, $16,079.85 galvanizing, and $1,250.00 tooling.",
      "Family subtotals: H-series $12,100.33, V-series $17,959.56, R-series $1,966.87, D-series $3,834.89.",
      "Heavier 11 GA lines called out in the source: H4L, V3L, and D5L."
    ],
    parts: burningManParts()
  };
}

function presetReference(sourceLabel: string, note: string, knownParameters: string[]): ProjectState["reference"] {
  return {
    sourceLabel,
    note,
    knownParameters,
    unknownParameters: ["Detailed node coordinates.", "Complete fabrication cost basis."],
    pricingSummary: [],
    parts: []
  };
}

function preset(id: string, location: string, note: string, options: PresetOptions): ProjectPreset {
  const state = cloneProjectState(defaultProject);
  const presetUsdRate = usdRateForPreset(options.currency);
  state.project.currency = "USD";
  if (options.lengthGroupToleranceMm) state.project.lengthGroupToleranceMm = options.lengthGroupToleranceMm;
  state.geometry.pattern = options.pattern;
  state.geometry.diameterM = options.diameterM;
  const coverage = options.sphereCoverage ?? defaultCoverage(options.shape);
  const radius = options.diameterM / 2;
  const capHeightM = options.diameterM * coverage;
  const cutPlaneZ = radius - capHeightM;
  state.geometry.shape = options.shape ?? (coverage >= 0.995 ? "full-sphere" : "spherical-cap");
  state.geometry.sphereCoverage = coverage;
  state.geometry.flatBase = options.flatBase ?? state.geometry.shape === "flattened-base";
  state.geometry.capHeightM = capHeightM;
  state.geometry.cutPlaneZ = cutPlaneZ;
  state.geometry.topCutPlaneZ = options.topCutRatio !== undefined ? radius * options.topCutRatio : radius;
  state.geometry.bottomCutPlaneZ =
    options.bottomCutRatio !== undefined ? radius * options.bottomCutRatio : cutPlaneZ;
  if (options.frequency) state.geodesic.frequency = options.frequency;
  if (options.sectors) state.lamella.sectors = options.sectors;
  if (options.rings) {
    state.lamella.rings = options.rings;
    state.ribbedRectangular.rings = options.rings;
  }
  if (options.lamellaStyle) state.lamella.style = options.lamellaStyle;
  if (options.handedness) state.lamella.handedness = options.handedness;
  if (options.triangulation) state.lamella.triangulation = options.triangulation;
  if (options.ribs) state.ribbedRectangular.ribs = options.ribs;
  if (options.diagonalBracing) state.ribbedRectangular.diagonalBracing = options.diagonalBracing;
  if (options.connectorSystem) state.connectorSystem = options.connectorSystem;
  if (options.materialName) state.material.materialName = options.materialName;
  if (options.profileType) state.material.profileType = options.profileType;
  if (options.profileLabel) state.material.profileLabel = options.profileLabel;
  state.material.strutDiameterMm = options.strutDiameterMm;
  if (options.costPerMeter !== undefined) state.material.costPerMeter = convertPresetMoney(options.costPerMeter, presetUsdRate);
  if (options.stockLengthM !== undefined) state.material.stockLengthM = options.stockLengthM;
  if (options.wasteFactor !== undefined) state.material.wasteFactor = options.wasteFactor;
  if (options.endOperationCostPerEnd !== undefined) {
    state.material.endOperationCostPerEnd = convertPresetMoney(options.endOperationCostPerEnd, presetUsdRate);
  }
  if (options.nodeBaseCost !== undefined) state.material.nodeBaseCost = convertPresetMoney(options.nodeBaseCost, presetUsdRate);
  if (options.nodePerStrutAdder !== undefined) {
    state.material.nodePerStrutAdder = convertPresetMoney(options.nodePerStrutAdder, presetUsdRate);
  }
  if (options.setupCost !== undefined) state.material.setupCost = convertPresetMoney(options.setupCost, presetUsdRate);
  if (options.contingencyPercent !== undefined) state.material.contingencyPercent = options.contingencyPercent;
  if (options.flattenedBolted) {
    const { boltCost, nutCost, washerCost } = options.flattenedBolted;
    state.connectors.flattenedBolted = {
      ...state.connectors.flattenedBolted,
      ...options.flattenedBolted,
      boltCost:
        boltCost === undefined ? state.connectors.flattenedBolted.boltCost : convertPresetNumber(boltCost, presetUsdRate),
      nutCost: nutCost === undefined ? state.connectors.flattenedBolted.nutCost : convertPresetNumber(nutCost, presetUsdRate),
      washerCost:
        washerCost === undefined
          ? state.connectors.flattenedBolted.washerCost
          : convertPresetNumber(washerCost, presetUsdRate)
    };
  }
  if (options.reference) state.reference = options.reference;
  return {
    id,
    name: `${id} - ${location}`,
    location,
    note,
    state
  };
}

function usdRateForPreset(currencyCode?: string): number {
  const normalized = currencyCode?.trim().toUpperCase() || "USD";
  return PRESET_USD_RATES[normalized] ?? 1;
}

function convertPresetMoney(value: number | null, usdRate: number): number | null {
  if (value === null) return value;
  return value * usdRate;
}

function convertPresetNumber(value: number, usdRate: number): number {
  return value * usdRate;
}

function defaultCoverage(shape?: ProjectState["geometry"]["shape"]): number {
  if (shape === "hemisphere") return 0.5;
  if (shape === "spherical-cap" || shape === "flattened-base" || shape === "sphere-segment") return 0.625;
  return 1;
}

function burningManParts(): NonNullable<ProjectState["reference"]>["parts"] {
  return [
    burningManPart("H1", 21, 1995, 2071, 9, '2.0" 16 GA', 57.07, 1198.55),
    burningManPart("H2L", 21, 1955, 2031, 9, '2.0" 16 GA', 56.64, 1189.37),
    burningManPart("H2U", 20, 1955, 2031, 9, '2.0" 16 GA', 56.64, 1132.73),
    burningManPart("H3L", 21, 1833, 1909, 8, '2.0" 16 GA', 55.3, 1161.38),
    burningManPart("H3U", 20, 1833, 1909, 8, '2.0" 16 GA', 55.3, 1106.07),
    burningManPart("H4L", 21, 1623, 1699, 7, '2.0" 11 GA', 67.74, 1422.6),
    burningManPart("H4U", 20, 1623, 1699, 7, '2.0" 16 GA', 53.01, 1060.18),
    burningManPart("H5L", 21, 1322, 1398, 6, '2.0" 16 GA', 49.72, 1044.13),
    burningManPart("H5U", 20, 1322, 1398, 6, '2.0" 16 GA', 49.72, 994.4),
    burningManPart("H6L", 11, 1839, 1915, 8, '2.0" 16 GA', 55.37, 609.06),
    burningManPart("H6U", 10, 1839, 1915, 8, '2.0" 16 GA', 55.37, 553.69),
    burningManPart("H7L", 6, 1998, 2074, 9, '2.0" 16 GA', 57.11, 342.64),
    burningManPart("H7U", 5, 1998, 2074, 9, '2.0" 16 GA', 57.11, 285.53),
    burningManPart("V1L", 41, 1615, 1691, 7, '2.0" 16 GA', 52.92, 2169.79),
    burningManPart("V1U", 41, 1615, 1691, 7, '2.0" 16 GA', 52.92, 2169.79),
    burningManPart("V2L", 41, 1615, 1691, 7, '2.0" 16 GA', 52.92, 2169.79),
    burningManPart("V2U", 41, 1615, 1691, 7, '2.0" 16 GA', 52.92, 2169.79),
    burningManPart("V3L", 41, 1615, 1691, 7, '2.0" 11 GA', 67.59, 2771.03),
    burningManPart("V3U", 41, 1615, 1691, 7, '2.0" 16 GA', 52.92, 2169.79),
    burningManPart("V4L", 41, 1615, 1691, 7, '2.0" 16 GA', 52.92, 2169.79),
    burningManPart("V4U", 41, 1615, 1691, 7, '2.0" 16 GA', 52.92, 2169.79),
    burningManPart("R5L", 11, 1521, 1597, 7, '2.0" 16 GA', 51.89, 570.84),
    burningManPart("R5U", 10, 1521, 1597, 7, '2.0" 16 GA', 51.9, 518.95),
    burningManPart("R6L", 6, 1372, 1448, 6, '2.0" 16 GA', 50.27, 301.6),
    burningManPart("R6U", 5, 1372, 1448, 6, '2.0" 16 GA', 50.27, 251.33),
    burningManPart("R7U", 6, 1716, 1792, 8, '2.0" 16 GA', 54.02, 324.15),
    burningManPart("D5L", 21, 1882, 1958, 8, '2.0" 11 GA', 72.82, 1529.2),
    burningManPart("D5U", 20, 1882, 1958, 8, '2.0" 16 GA', 55.84, 1116.78),
    burningManPart("D6L", 11, 1953, 2029, 9, '2.0" 16 GA', 56.61, 622.76),
    burningManPart("D6U", 10, 1953, 2029, 9, '2.0" 16 GA', 56.61, 566.15)
  ];
}

function burningManPart(
  id: string,
  quantity: number,
  holeSpacingMm: number,
  strutLengthMm: number,
  bendAngleDeg: number,
  tubeType: string,
  unitPriceUsd: number,
  lineTotalUsd: number
): NonNullable<ProjectState["reference"]>["parts"][number] {
  return pricedPart(id, burningManPartDescription(id), quantity, strutLengthMm, holeSpacingMm, unitPriceUsd, lineTotalUsd, {
    bendAngleDeg,
    tubeType
  });
}

function burningManPartDescription(id: string): string {
  const family = id[0];
  if (family === "H") return "Horizontal member";
  if (family === "V") return "Vertical member";
  if (family === "R") return "Radial member";
  return "Diagonal member";
}

function pricedPart(
  id: string,
  description: string,
  quantity: number,
  cutLengthMm: number,
  fabricationLengthMm: number,
  unitPriceUsd: number,
  lineTotalUsd: number,
  options: {
    spares?: number;
    totalQuantity?: number;
    endAngleADeg?: number;
    endAngleBDeg?: number;
    bendAngleDeg?: number;
    color?: string;
    tubeType?: string;
  } = {}
): NonNullable<ProjectState["reference"]>["parts"][number] {
  return {
    id,
    description,
    quantity,
    spares: options.spares,
    totalQuantity: options.totalQuantity,
    cutLengthM: cutLengthMm / 1000,
    fabricationLengthM: fabricationLengthMm / 1000,
    endAngleADeg: options.endAngleADeg,
    endAngleBDeg: options.endAngleBDeg,
    bendAngleDeg: options.bendAngleDeg,
    color: options.color,
    tubeType: options.tubeType,
    unitPriceUsd,
    lineTotalUsd
  };
}

function convertGbpToUsd(value: number): number {
  return convertPresetNumber(value, PRESET_USD_RATES.GBP ?? 1);
}

function part(
  id: string,
  description: string,
  quantity: number,
  cutLengthMm: number,
  holeSpacingMm: number,
  endAngleADeg?: number,
  endAngleBDeg?: number,
  color?: string
): NonNullable<ProjectState["reference"]>["parts"][number] {
  return {
    id,
    description,
    quantity,
    cutLengthM: cutLengthMm / 1000,
    fabricationLengthM: holeSpacingMm / 1000,
    endAngleADeg,
    endAngleBDeg,
    color
  };
}

function shedPart(
  id: string,
  quantity: number,
  spares: number,
  holeSpacingMm: number,
  strutLengthIn: number,
  bendAngleDeg: number,
  tubeType: string
): NonNullable<ProjectState["reference"]>["parts"][number] {
  const family = id[0];
  const description =
    family === "H"
      ? "Horizontal ring member"
      : family === "V"
        ? "Vertical/diagonal lattice member"
        : "Polar/radial member";
  return {
    id,
    description,
    quantity,
    spares,
    totalQuantity: quantity + spares,
    cutLengthM: (strutLengthIn * 25.4) / 1000,
    fabricationLengthM: holeSpacingMm / 1000,
    bendAngleDeg,
    tubeType
  };
}
