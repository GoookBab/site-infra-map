import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";


const workspaceDir = process.env.WORKSPACE_DIR;
const skillDir = process.env.PRESENTATIONS_SKILL_DIR;
const runtimePython = process.env.RUNTIME_PYTHON;
const tmpDir = process.env.PPTX_BUILD_DIR;
const finalPath = process.env.FINAL_PPTX;
if (![workspaceDir, skillDir, runtimePython, tmpDir, finalPath].every((p) => path.isAbsolute(p ?? ""))) {
  throw new Error("WORKSPACE_DIR, PRESENTATIONS_SKILL_DIR, RUNTIME_PYTHON, PPTX_BUILD_DIR, FINAL_PPTX must be absolute paths");
}

const overviewImagePath = process.env.OVERVIEW_IMAGE ?? path.join(workspaceDir, "outputs/satellite_base_overview.png");
const overviewJsonPath = process.env.OVERVIEW_JSON ?? path.join(workspaceDir, "outputs/satellite_overview.json");
const detailImagePath = process.env.DETAIL_IMAGE ?? path.join(workspaceDir, "outputs/satellite_base_site_detail.png");
const detailJsonPath = process.env.DETAIL_JSON ?? path.join(workspaceDir, "outputs/satellite_site_detail.json");
const designPath = process.env.DESIGN_MD ?? path.join(workspaceDir, "DESIGN.md");

const { finalizePresentation } = await import(pathToFileURL(
  path.join(skillDir, "container_tools/artifact_tool_utils.mjs"),
).href);

await fs.mkdir(tmpDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });

const [overviewImage, detailImage, overview, detail, designText] = await Promise.all([
  fs.readFile(overviewImagePath),
  fs.readFile(detailImagePath),
  JSON.parse(await fs.readFile(overviewJsonPath, "utf8")),
  JSON.parse(await fs.readFile(detailJsonPath, "utf8")),
  fs.readFile(designPath, "utf8"),
]);

const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
function designString(name, fallback) {
  const match = designText.match(new RegExp(`^\\s{2}${name}:\\s*"([^"]+)"`, "m"));
  return match?.[1] ?? fallback;
}
const FONT = designString("font-family", "페이퍼로지 4 Regular");
const FONT_MEDIUM = designString("font-family-medium", "페이퍼로지 5 Medium");
const FONT_SEMIBOLD = designString("font-family-semibold", "페이퍼로지 6 SemiBold");
const FONT_BOLD = designString("font-family-bold", "페이퍼로지 7 Bold");
function designColor(name, fallback) {
  const match = designText.match(new RegExp(`^\\s{2}${name}:\\s*"([#A-Fa-f0-9]+)"`, "m"));
  return match?.[1] ?? fallback;
}
const COLORS = {
  primary: designColor("primary", "#F54E00"),
  ink: designColor("ink", "#26251E"),
  body: designColor("body", "#5A5852"),
  muted: designColor("muted", "#807D72"),
  mutedSoft: designColor("muted-soft", "#A09C92"),
  hairline: designColor("hairline", "#E6E5E0"),
  hairlineStrong: designColor("hairline-strong", "#CFCDC4"),
  canvas: designColor("canvas", "#F7F7F4"),
  canvasSoft: designColor("canvas-soft", "#FAFAF7"),
  surface: designColor("surface-card", "#FFFFFF"),
  white: "#FFFFFF",
  target: designColor("primary", "#F54E00"),
  facility: designColor("ink", "#26251E"),
  facilityLine: "#FFFFFF",
  radius: designColor("primary", "#F54E00"),
  outside: designColor("muted-soft", "#A09C92"),
  paper: designColor("canvas", "#F7F7F4"),
  line: designColor("hairline", "#E6E5E0"),
};

function addText(slide, text, position, style = {}, options = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: options.name,
    position,
    fill: options.fill ?? "none",
    line: options.line ?? { fill: "none", width: 0 },
    borderRadius: options.borderRadius,
  });
  shape.text = text;
  const requestedBold = style.bold === true;
  shape.text.style = {
    typeface: FONT,
    fontSize: 20,
    color: COLORS.ink,
    autoFit: "shrinkText",
    ...style,
    typeface: style.typeface ?? (requestedBold ? FONT_SEMIBOLD : FONT),
    bold: false,
  };
  return shape;
}

function addCircle(slide, x, y, radius, fill, name) {
  return slide.shapes.add({
    geometry: "ellipse",
    name,
    position: { left: x - radius, top: y - radius, width: radius * 2, height: radius * 2 },
    fill,
    line: { style: "solid", fill: COLORS.white, width: 2 },
  });
}

function addParcel(slide, rings, meta, mapFrame, color, width, name) {
  const sx = mapFrame.width / meta.width;
  const sy = mapFrame.height / meta.height;
  for (let index = 0; index < rings.length; index += 1) {
    const ring = rings[index];
    if (ring.length < 2) continue;
    const commands = [{ moveTo: { x: ring[0][0] * sx, y: ring[0][1] * sy } }];
    for (const point of ring.slice(1)) {
      commands.push({ lineTo: { x: point[0] * sx, y: point[1] * sy } });
    }
    commands.push({ close: {} });
    slide.shapes.add({
      geometry: "custom",
      name: `${name}-${index + 1}`,
      position: mapFrame,
      fill: "none",
      line: { style: "solid", fill: color, width },
      customPaths: [{ width: mapFrame.width, height: mapFrame.height, commands }],
    });
  }
}

function addEditableMap(slide, imageBytes, meta, { showRadius, detailView = false }) {
  const mapFrame = { left: 32, top: 32, width: 656, height: 656 };
  slide.shapes.add({
    geometry: "rect",
    name: "지도 카드",
    position: mapFrame,
    fill: COLORS.surface,
    line: { style: "solid", fill: COLORS.hairlineStrong, width: 1 },
    borderRadius: 12,
  });
  slide.images.add({
    blob: imageBytes,
    contentType: "image/png",
    alt: detailView ? "대상지 확대 VWorld 위성영상" : "대상지 주변 VWorld 위성영상",
    fit: "cover",
    position: mapFrame,
  });
  const sx = mapFrame.width / meta.width;
  const sy = mapFrame.height / meta.height;
  if (showRadius) {
    const radiusPx = meta.search_radius_m / meta.meters_per_pixel;
    slide.shapes.add({
      geometry: "ellipse",
      name: "검색 반경",
      position: {
        left: mapFrame.left + meta.site_x * sx - radiusPx * sx,
        top: mapFrame.top + meta.site_y * sy - radiusPx * sy,
        width: radiusPx * 2 * sx,
        height: radiusPx * 2 * sy,
      },
      fill: "none",
      line: { style: "solid", fill: COLORS.radius, width: 3 },
    });
  }

  const visibleFeatures = meta.features.filter((feature) =>
    feature.x >= -20 && feature.x <= meta.width + 20 && feature.y >= -20 && feature.y <= meta.height + 20
  );
  for (const feature of visibleFeatures) {
    addParcel(
      slide,
      feature.parcel_rings,
      meta,
      mapFrame,
      feature.is_site ? COLORS.target : COLORS.facilityLine,
      feature.is_site ? 4 : 2,
      feature.is_site ? "대상지 필지" : `${feature.name} 필지`,
    );
  }

  const placed = [];
  for (const feature of visibleFeatures) {
    const x = mapFrame.left + feature.x * sx;
    const y = mapFrame.top + feature.y * sy;
    const color = feature.is_site ? COLORS.target : feature.within_radius ? COLORS.facility : COLORS.outside;
    addCircle(slide, x, y, feature.is_site ? 10 : 8, color, `${feature.name} 위치`);
    const label = feature.is_site ? "대상지" : `${feature.name}  ${Math.round(feature.distance_m)}m`;
    const labelWidth = Math.min(250, Math.max(78, 14 * label.length));
    const labelHeight = 30;
    const candidates = [];
    for (const offsetY of [-80, -44, -8, 28, 64, 100]) {
      candidates.push({ left: x + 14, top: y + offsetY });
      candidates.push({ left: x - labelWidth - 14, top: y + offsetY });
    }
    let chosen = candidates[0];
    let accepted = false;
    for (const candidate of candidates) {
      const rect = { ...candidate, right: candidate.left + labelWidth, bottom: candidate.top + labelHeight };
      const inFrame = rect.left >= mapFrame.left + 4 && rect.right <= mapFrame.left + mapFrame.width - 4 && rect.top >= mapFrame.top + 4 && rect.bottom <= mapFrame.top + mapFrame.height - 4;
      const overlaps = placed.some((old) => !(rect.right < old.left || rect.left > old.right || rect.bottom < old.top || rect.top > old.bottom));
      if (inFrame && !overlaps) {
        chosen = candidate;
        placed.push(rect);
        accepted = true;
        break;
      }
    }
    if (!accepted) {
      chosen = {
        left: Math.max(mapFrame.left + 4, Math.min(mapFrame.left + mapFrame.width - labelWidth - 4, x + 14)),
        top: Math.max(mapFrame.top + 4, Math.min(mapFrame.top + mapFrame.height - labelHeight - 4, y + 8)),
      };
    }
    addText(slide, label, { ...chosen, width: labelWidth, height: labelHeight }, {
      fontSize: 16, bold: false, color: COLORS.ink, autoFit: "shrinkText",
    }, {
      name: `${feature.name} 라벨`, fill: COLORS.surface, borderRadius: 6,
      line: { style: "solid", fill: COLORS.hairlineStrong, width: 1 },
    });
  }
  return mapFrame;
}

function addPanelBase(slide) {
  slide.shapes.add({
    geometry: "rect",
    name: "정보 패널 배경",
    position: { left: 720, top: 0, width: 560, height: 720 },
    fill: COLORS.canvas,
    line: { style: "solid", fill: COLORS.hairline, width: 1 },
  });
}

function addPageNumber(slide, number) {
  addText(slide, String(number).padStart(2, "0"), { left: 1190, top: 674, width: 42, height: 22 }, {
    fontSize: 13, color: COLORS.muted, alignment: "right",
  }, { name: "페이지 번호" });
}

function addLegendItem(slide, y, color, label, kind = "circle") {
  if (kind === "line") {
    slide.shapes.add({
      geometry: "line", position: { left: 770, top: y + 10, width: 30, height: 0 },
      fill: "none", line: { style: "solid", fill: color, width: 3 },
    });
  } else {
    addCircle(slide, 785, y + 10, 7, color, `${label} 범례`);
  }
  addText(slide, label, { left: 814, top: y - 3, width: 380, height: 28 }, {
      fontSize: 18, color: COLORS.ink,
  });
}

// Slide 1: overview
{
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.canvas;
  addEditableMap(slide, overviewImage, overview, { showRadius: true });
  addPanelBase(slide);
  const site = overview.features.find((feature) => feature.is_site);
  const inside = overview.features.filter((feature) => !feature.is_site && feature.within_radius).length;
  const outside = overview.features.filter((feature) => !feature.is_site && !feature.within_radius).length;
  addText(slide, "대상지 주변 인프라", { left: 770, top: 56, width: 450, height: 62 }, {
    fontSize: 46, bold: false, color: COLORS.ink,
  }, { name: "슬라이드 제목" });
  addText(slide, site.address, { left: 770, top: 132, width: 430, height: 64 }, {
    fontSize: 20, color: COLORS.body,
  }, { name: "대상지 주소" });
  addText(slide, `검색 반경  ${overview.search_radius_m / 1000} km`, { left: 770, top: 224, width: 410, height: 48 }, {
    fontSize: 28, bold: false, color: COLORS.ink,
  });
  addText(slide, `반경 내 ${inside}개 시설`, { left: 770, top: 286, width: 410, height: 48 }, {
    fontSize: 32, bold: false, color: COLORS.primary,
  });
  if (outside) {
    addText(slide, `반경 밖 ${outside}개 시설은 회색으로 표시`, { left: 770, top: 340, width: 430, height: 34 }, {
      fontSize: 19, color: COLORS.muted,
    });
  }
  addLegendItem(slide, 430, COLORS.target, "대상지 주소점");
  addLegendItem(slide, 474, COLORS.facility, "검증된 시설 주소점");
  addLegendItem(slide, 518, COLORS.ink, "연속지적도 필지 경계", "line");
  addLegendItem(slide, 562, COLORS.radius, "검색 반경", "line");
  addText(slide, "모든 표식과 선, 라벨은 PowerPoint에서 수정 가능", { left: 770, top: 646, width: 440, height: 36 }, {
    fontSize: 18, color: COLORS.muted,
  });
  addPageNumber(slide, 1);
  slide.speakerNotes.textFrame.setText(
    "지도: VWorld Satellite WMTS. 필지: VWorld LP_PA_CBND_BUBUN. 시설 출처:\n" +
    overview.features.filter((f) => f.source_url).map((f) => `${f.name}: ${f.source_url}`).join("\n")
  );
}

// Slide 2: target detail
{
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.canvas;
  addEditableMap(slide, detailImage, detail, { showRadius: false, detailView: true });
  addPanelBase(slide);
  const site = detail.features.find((feature) => feature.is_site);
  addText(slide, "대상지 필지 정합성", { left: 770, top: 56, width: 450, height: 62 }, {
    fontSize: 46, bold: false, color: COLORS.ink,
  });
  addText(slide, site.address, { left: 770, top: 132, width: 430, height: 64 }, {
    fontSize: 20, color: COLORS.body,
  });
  addText(slide, "좌표", { left: 770, top: 236, width: 120, height: 32 }, {
    fontSize: 19, bold: true, color: COLORS.muted,
  });
  addText(slide, `${site.longitude.toFixed(8)}, ${site.latitude.toFixed(8)}`, { left: 770, top: 270, width: 430, height: 44 }, {
    fontSize: 24, bold: false, color: COLORS.ink,
  });
  addText(slide, "PNU", { left: 770, top: 338, width: 120, height: 32 }, {
    fontSize: 19, bold: true, color: COLORS.muted,
  });
  addText(slide, site.pnu, { left: 770, top: 372, width: 430, height: 44 }, {
    fontSize: 24, bold: false, color: COLORS.ink,
  });
  addText(slide, "검증 상태", { left: 770, top: 440, width: 140, height: 32 }, {
    fontSize: 19, bold: true, color: COLORS.muted,
  });
  addText(slide, site.accuracy, { left: 770, top: 474, width: 330, height: 44 }, {
    fontSize: 27, bold: false, color: COLORS.primary,
  });
  addText(slide, "주소점이 조회된 필지 내부에 위치합니다. 빨간 필지선과 핀은 각각 편집 가능한 도형입니다.", { left: 770, top: 560, width: 430, height: 86 }, {
    fontSize: 20, color: COLORS.body,
  });
  addPageNumber(slide, 2);
  slide.speakerNotes.textFrame.setText(
    "주소 좌표와 필지 도형은 VWorld API 응답을 사용했습니다. parcel_verified는 주소점과 필지의 포함 관계를 뜻하며 출입구 위치를 보증하지 않습니다."
  );
}

// Slide 3: editable data table
{
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.paper;
  addText(slide, "인프라 좌표 데이터", { left: 64, top: 42, width: 760, height: 58 }, {
    fontSize: 46, bold: false, color: COLORS.ink,
  });
  addText(slide, "주소, 거리, 검증 상태를 PowerPoint 표에서 직접 수정할 수 있습니다", { left: 64, top: 102, width: 900, height: 38 }, {
    fontSize: 20, color: COLORS.body,
  });
  const facilities = overview.features.filter((feature) => !feature.is_site);
  const values = [
    ["시설명", "분류", "주소", "거리", "반경", "검증 상태"],
    ...facilities.map((feature) => [
      feature.name,
      ({ school: "학교", park: "공원", culture: "문화" })[feature.category] ?? feature.category,
      feature.address,
      `${Math.round(feature.distance_m)} m`,
      feature.within_radius ? "내부" : "외부",
      feature.accuracy,
    ]),
  ];
  const table = slide.tables.add({
    rows: values.length,
    columns: 6,
    left: 64,
    top: 166,
    width: 1152,
    height: 438,
    columnWidths: [180, 90, 470, 105, 90, 200],
    values,
  });
  table.borders.assign({ style: "solid", fill: COLORS.line, width: 1 });
  table.cells.block({ row: 0, column: 0, rowCount: 1, columnCount: 6 }).assign({
    fill: COLORS.ink,
    textStyle: { typeface: FONT_SEMIBOLD, fontSize: 16, bold: false, color: COLORS.white },
    margins: { left: 10, right: 10, top: 8, bottom: 8 },
  });
  table.cells.block({ row: 1, column: 0, rowCount: facilities.length, columnCount: 6 }).assign({
    textStyle: { typeface: FONT, fontSize: 15, color: COLORS.ink },
    margins: { left: 8, right: 8, top: 6, bottom: 6 },
  });
  for (let row = 1; row <= facilities.length; row += 1) {
    if (row % 2 === 0) {
      table.cells.block({ row, column: 0, rowCount: 1, columnCount: 6 }).fill = COLORS.canvasSoft;
    }
    if (!facilities[row - 1].within_radius) {
      table.getCell(row, 4).fill = COLORS.hairline;
      table.getCell(row, 4).text.style = { typeface: FONT_SEMIBOLD, fontSize: 16, bold: false, color: COLORS.primary };
    }
  }
  addText(slide, "정확도 기준: parcel_verified는 주소점이 해당 필지 내부에 있음을 뜻합니다", { left: 64, top: 638, width: 960, height: 30 }, {
    fontSize: 17, color: COLORS.muted,
  });
  addPageNumber(slide, 3);
  slide.speakerNotes.textFrame.setText(
    overview.features.filter((f) => f.source_url).map((f) => `${f.name}: ${f.source_url}`).join("\n")
  );
}

const stagingDir = path.join(workspaceDir, ".codex-finalizer");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "site_infrastructure_editable_candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const requirements = {
  explicitTotalSlideCount: 3,
  requiredNativeTableOwnerSlides: [3],
  requiredNativeChartOwnerSlides: [],
};
const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "12192000,6858000",
    "--validate-heading-fit",
    "--require-native-table-slide", "3",
  ],
  requiredNativeTableOwnerSlides: [3],
  fontPolicy: { basis: "user_request", families: [FONT, FONT_SEMIBOLD] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, `${path.basename(finalPath)}.validation.json`),
});

console.log(JSON.stringify({ finalPath: result.finalPath ?? finalPath }));
