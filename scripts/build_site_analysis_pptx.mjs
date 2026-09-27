import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspaceDir = process.env.WORKSPACE_DIR;
const skillDir = process.env.PRESENTATIONS_SKILL_DIR;
const runtimePython = process.env.RUNTIME_PYTHON;
const runtimeNodeModules = process.env.RUNTIME_NODE_MODULES;
const configPath = process.env.SITE_ANALYSIS_CONFIG;
const runDir = process.env.SITE_ANALYSIS_RUN_DIR;
const finalPath = process.env.FINAL_PPTX;
if (![workspaceDir, skillDir, runtimePython, runtimeNodeModules, configPath, runDir, finalPath]
  .every((value) => path.isAbsolute(value ?? ""))) {
  throw new Error("All site-analysis and presentation runtime paths must be absolute");
}

const { Presentation, PresentationFile } = await import(pathToFileURL(
  path.join(runtimeNodeModules, "@oai/artifact-tool/dist/artifact_tool.mjs"),
).href);
const { finalizePresentation } = await import(pathToFileURL(
  path.join(skillDir, "container_tools/artifact_tool_utils.mjs"),
).href);

const config = JSON.parse(await fs.readFile(configPath, "utf8"));
const presentationConfig = config.presentation ?? {};
const project = config.project;
const overview = JSON.parse(await fs.readFile(path.join(runDir, "satellite_overview.json"), "utf8"));
const mapBytes = await fs.readFile(path.join(runDir, "satellite_base_overview.png"));
const featureByName = new Map(overview.features.map((feature) => [feature.name, feature]));

const W = 1122.5000524934383;
const H = 793.6666666666666;
const FONT_BOLD = presentationConfig.font_family ?? "페이퍼로지 7 Bold";
const BLACK = "#111111";
const WHITE = "#FFFFFF";
const SITE = "#E53935";
const FACILITY = "#F07B42";
const TYPE_COLORS = { "초": "#F5C04A", "중": "#4A90E2", "고": "#8E6CCB", "특수": "#67A86B", "기타": "#8C8C8C" };
const TYPE_FILLS = { "초": "#FFF1C8", "중": "#DCEEFF", "고": "#E8DFF6", "특수": "#DDEEDC", "기타": "#E9E9E9" };

function absoluteWorkspacePath(relativePath) {
  const candidate = path.resolve(workspaceDir, relativePath);
  const relative = path.relative(workspaceDir, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Configured path leaves the workspace: ${relativePath}`);
  }
  return candidate;
}

function coordinates(item) {
  const feature = featureByName.get(item.name);
  if (feature?.longitude != null && feature?.latitude != null) {
    return { lon: feature.longitude, lat: feature.latitude, distance_m: feature.distance_m };
  }
  if (item.longitude != null && item.latitude != null) {
    return { lon: item.longitude, lat: item.latitude, distance_m: item.distance_m };
  }
  throw new Error(`No coordinates are available for ${item.name}`);
}

const maxSchools = Math.min(16, presentationConfig.max_schools ?? 16);
const maxFacilities = Math.min(6, presentationConfig.max_facilities ?? 6);
const schools = config.schools.slice(0, maxSchools).map((item) => ({
  ...item,
  short: item.short_name ?? item.name,
  type: item.school_type,
  count: item.student_count,
  ...coordinates(item),
}));
const facilities = config.facilities.slice(0, maxFacilities).map((item) => ({
  ...item,
  short: item.short_name ?? item.name,
  ...coordinates(item),
}));

const photoBytes = new Map();
for (const facility of facilities) {
  const imagePath = facility.image?.path;
  if (!imagePath) throw new Error(`facility image.path is required for ${facility.name}`);
  photoBytes.set(facility.name, await fs.readFile(absoluteWorkspacePath(imagePath)));
}

const deck = Presentation.create({ slideSize: { width: W, height: H } });

function shape(slide, geometry, position, fill = "none", line = { fill: "none", width: 0 }, name) {
  return slide.shapes.add({ geometry, position, fill, line, name });
}

function text(slide, value, position, style = {}, opts = {}) {
  const box = shape(slide, "textbox", position, opts.fill ?? "none", opts.line ?? { fill: "none", width: 0 }, opts.name);
  box.text = value;
  box.text.style = {
    typeface: FONT_BOLD,
    fontSize: style.fontSize ?? 14,
    color: style.color ?? BLACK,
    bold: false,
    autoFit: style.autoFit ?? "none",
    wrap: style.wrap ?? "square",
    insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "top",
    ...style,
    typeface: FONT_BOLD,
    bold: false,
  };
  return box;
}

function addTitle(slide, subtitle, titleY, subtitleY) {
  text(slide, presentationConfig.section_title ?? "1.  지역사회 및 주변현황",
    { left: 96.25, top: titleY, width: 400, height: 19.39 },
    { fontSize: 16, wrap: "none" });
  text(slide, subtitle, { left: 96.25, top: subtitleY, width: 520, height: 21.81 },
    { fontSize: 14, wrap: "none" });
}

function addBulletHeading(slide, label, x, y, width) {
  shape(slide, "ellipse", { left: x, top: y + 8, width: 5, height: 5 }, BLACK, { fill: "none", width: 0 });
  text(slide, label, { left: x + 11, top: y, width: width - 11, height: 16.16 }, { fontSize: 13.333 });
}

function addBodyParagraphs(slide, paragraphs, position) {
  const box = shape(slide, "textbox", position, "none", { fill: "none", width: 0 }, "본문 설명");
  box.text.set(paragraphs.map((paragraph) => ({
    bulletCharacter: "-", marginLeft: 18, indent: -18, spaceAfter: 4, runs: [paragraph],
  })));
  box.text.style = {
    typeface: FONT_BOLD, fontSize: 10.667, color: BLACK, bold: false,
    alignment: "justify", verticalAlignment: "top", autoFit: "shrinkText", wrap: "square",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
}

function worldPixel(lon, lat, zoom = 16) {
  const size = 256 * 2 ** zoom;
  const x = (lon + 180) / 360 * size;
  const sin = Math.sin(lat * Math.PI / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size;
  return { x, y };
}

const siteFeature = overview.features.find((feature) => feature.is_site) ?? overview.features[0];
const siteWorld = worldPixel(siteFeature.longitude, siteFeature.latitude, overview.zoom);
const origin = { x: siteWorld.x - overview.site_x, y: siteWorld.y - overview.site_y };
function geoToSource(lon, lat) {
  const point = worldPixel(lon, lat, overview.zoom);
  return { x: point.x - origin.x, y: point.y - origin.y };
}
function mapTransform(frame, point) {
  const scale = Math.max(frame.width / overview.width, frame.height / overview.height);
  const drawnW = overview.width * scale;
  const drawnH = overview.height * scale;
  return {
    x: frame.left + (frame.width - drawnW) / 2 + point.x * scale,
    y: frame.top + (frame.height - drawnH) / 2 + point.y * scale,
    scale,
  };
}

function addBaseMap(slide, frame) {
  slide.images.add({
    blob: mapBytes, contentType: "image/png",
    alt: `${project.site_address} 주변 VWorld 위성지도`, fit: "cover", position: frame,
  });
  shape(slide, "rect", frame, "none", { style: "solid", fill: "#B9B9B9", width: 0.7 }, "지도 테두리");
  const site = mapTransform(frame, { x: overview.site_x, y: overview.site_y });
  const radiusPx = overview.search_radius_m / overview.meters_per_pixel;
  shape(slide, "ellipse", {
    left: site.x - radiusPx * site.scale, top: site.y - radiusPx * site.scale,
    width: radiusPx * site.scale * 2, height: radiusPx * site.scale * 2,
  }, "none", { style: "solid", fill: WHITE, width: 2.2 }, "검색 반경");
  shape(slide, "ellipse", { left: site.x - 6, top: site.y - 6, width: 12, height: 12 }, SITE,
    { style: "solid", fill: WHITE, width: 1.6 }, "대상지 위치");
  text(slide, project.site_label ?? "대상지", { left: site.x + 7, top: site.y - 12, width: 60, height: 18 },
    { fontSize: 9.333, color: WHITE, verticalAlignment: "middle" }, { fill: "#111111CC" });
  text(slide, "N", { left: frame.left + frame.width - 36, top: frame.top + 10, width: 22, height: 17 },
    { fontSize: 13.333, color: WHITE, alignment: "center" });
  shape(slide, "triangle", { left: frame.left + frame.width - 32, top: frame.top + 27, width: 14, height: 18 },
    BLACK, { style: "solid", fill: WHITE, width: 0.6 }, "북쪽 화살표");
  text(slide, `${Number(project.radius_m) / 1000}km`,
    { left: frame.left + 11, top: frame.top + frame.height - 28, width: 42, height: 17 },
    { fontSize: 13.333, color: WHITE, alignment: "center" }, { fill: "#111111C8" });
}

function addGeoMarker(slide, frame, item, color, placed) {
  const source = geoToSource(item.lon, item.lat);
  const point = mapTransform(frame, source);
  shape(slide, "ellipse", { left: point.x - 3.6, top: point.y - 3.6, width: 7.2, height: 7.2 }, color,
    { style: "solid", fill: WHITE, width: 0.8 }, `${item.name} 위치`);
  const label = item.short;
  const width = Math.min(110, Math.max(36, label.length * 9.8));
  const height = 14;
  const candidates = [[5, -15], [5, 2], [-width - 5, -15], [-width - 5, 2], [5, -30], [-width - 5, -30]];
  let selected = { left: point.x + 5, top: point.y - 15 };
  for (const [dx, dy] of candidates) {
    const rect = { left: point.x + dx, top: point.y + dy, right: point.x + dx + width, bottom: point.y + dy + height };
    const inside = rect.left > frame.left + 2 && rect.right < frame.left + frame.width - 2 && rect.top > frame.top + 2 && rect.bottom < frame.top + frame.height - 2;
    const collision = placed.some((old) => !(rect.right < old.left || rect.left > old.right || rect.bottom < old.top || rect.top > old.bottom));
    if (inside && !collision) { selected = rect; placed.push(rect); break; }
  }
  text(slide, label, { left: selected.left, top: selected.top, width, height },
    { fontSize: 9.333, verticalAlignment: "middle", autoFit: "shrinkText", wrap: "none" },
    { fill: "#FFFFFFDD", line: { style: "solid", fill: WHITE, width: 0.35 } });
}

function defaultSchoolNarrative() {
  const total = schools.reduce((sum, item) => sum + item.count, 0);
  const byType = new Map();
  for (const school of schools) byType.set(school.type, (byType.get(school.type) ?? 0) + school.count);
  const breakdown = [...byType.entries()].map(([type, count]) => `${type} ${count.toLocaleString("ko-KR")}명`).join(", ");
  const nearest = schools.filter((item) => Number.isFinite(item.distance_m)).sort((a, b) => a.distance_m - b.distance_m).slice(0, 2);
  const second = nearest.length
    ? `대상지에서 가까운 학교는 ${nearest.map((item) => `${item.short} 약 ${(item.distance_m / 1000).toFixed(1)}km`).join(", ")}이다.`
    : "학교별 위치는 주소 좌표와 필지 검증 결과를 기준으로 표시했다.";
  return [
    `반경 ${Number(project.radius_m) / 1000}km 내 표시 학교 ${schools.length}개교의 학생 수 합계는 ${total.toLocaleString("ko-KR")}명이다. ${breakdown}으로 집계된다.`,
    second,
  ];
}

function defaultFacilityNarrative() {
  return [`대상지 반경 ${Number(project.radius_m) / 1000}km의 주요 유사시설로 ${facilities.map((item) => item.name).join(", ")}을 조사했다. 위치는 주소 좌표와 필지 검증 결과를 기준으로 표시했다.`];
}

// Slide 1: school catchment
{
  const slide = deck.slides.add();
  slide.background.fill = WHITE;
  addTitle(slide, presentationConfig.school_subtitle ?? `1.2 ${project.site_name} 예상 이용자 현황`, 134.59, 162);
  addBulletHeading(slide, presentationConfig.school_map_heading ?? `반경 ${Number(project.radius_m) / 1000}km 이내 학교 현황`, 96.5, 195.6, 411.97);
  addBulletHeading(slide, presentationConfig.school_table_heading ?? "이용가능한 인근 학교 학생 현황", 580.08, 195.6, 411.97);
  const mapFrame = { left: 96, top: 218.5, width: 446.7, height: 436.6 };
  addBaseMap(slide, mapFrame);
  const placed = [];
  for (const school of schools) addGeoMarker(slide, mapFrame, school, TYPE_COLORS[school.type] ?? TYPE_COLORS["기타"], placed);

  const split = Math.ceil(schools.length / 2);
  const left = schools.slice(0, split);
  const right = schools.slice(split);
  const rowCount = Math.max(left.length, right.length);
  const values = [["구분", "학교명", "학생수", "구분", "학교명", "학생수"]];
  for (let index = 0; index < rowCount; index += 1) {
    const a = left[index]; const b = right[index];
    values.push([
      a?.type ?? "", a?.name.replace(/^서울/, "") ?? "", a ? `${a.count.toLocaleString("ko-KR")}명` : "",
      b?.type ?? "", b?.name.replace(/^서울/, "") ?? "", b ? `${b.count.toLocaleString("ko-KR")}명` : "",
    ]);
  }
  const leftTotal = left.reduce((sum, item) => sum + item.count, 0);
  const rightTotal = right.reduce((sum, item) => sum + item.count, 0);
  values.push(["학교", "표시 소계", `${leftTotal.toLocaleString("ko-KR")}명`, "학교", "표시 소계", `${rightTotal.toLocaleString("ko-KR")}명`]);
  const tableHeight = Math.min(307.27, Math.max(180, (rowCount + 2) * 31));
  const table = slide.tables.add({
    rows: values.length, columns: 6, left: 579.57, top: 218.5, width: 446.68, height: tableHeight,
    columnWidths: [38, 113, 68, 46, 113, 68], values,
  });
  table.borders.assign({ style: "solid", fill: "#B7B7B7", width: 0.65 });
  table.cells.block({ row: 0, column: 0, rowCount: 1, columnCount: 6 }).assign({
    fill: "#6E747A", textStyle: { typeface: FONT_BOLD, fontSize: 10.667, bold: false, color: WHITE, alignment: "center" },
    margins: { left: 3, right: 3, top: 3, bottom: 3 },
  });
  if (rowCount > 0) table.cells.block({ row: 1, column: 0, rowCount, columnCount: 6 }).assign({
    textStyle: { typeface: FONT_BOLD, fontSize: 9.333, color: BLACK, alignment: "center" },
    margins: { left: 3, right: 3, top: 2.5, bottom: 2.5 },
  });
  for (let row = 1; row <= rowCount; row += 1) {
    if (left[row - 1]) table.getCell(row, 0).fill = TYPE_FILLS[left[row - 1].type] ?? TYPE_FILLS["기타"];
    if (right[row - 1]) table.getCell(row, 3).fill = TYPE_FILLS[right[row - 1].type] ?? TYPE_FILLS["기타"];
    if (row % 2 === 0) for (const column of [1, 2, 4, 5]) table.getCell(row, column).fill = "#F7F7F7";
  }
  table.cells.block({ row: rowCount + 1, column: 0, rowCount: 1, columnCount: 6 }).assign({
    fill: "#E9E9E9", textStyle: { typeface: FONT_BOLD, fontSize: 9.333, bold: false, color: BLACK, alignment: "center" },
    margins: { left: 3, right: 3, top: 3, bottom: 3 },
  });
  const narrativeTop = 218.5 + tableHeight + 8;
  addBodyParagraphs(slide, config.narratives?.school ?? defaultSchoolNarrative(),
    { left: 579.57, top: narrativeTop, width: 446.68, height: Math.max(60, 658 - narrativeTop) });
  slide.speakerNotes.textFrame.setText([
    `지도·좌표: VWorld 위성지도 및 주소 좌표 (${config.research_date ?? "조회일 미기재"})`,
    ...schools.map((item) => `${item.name}: ${item.source_url}`),
  ].join("\n"));
}

// Slide 2: nearby facilities
{
  const slide = deck.slides.add();
  slide.background.fill = WHITE;
  addTitle(slide, presentationConfig.facility_subtitle ?? `1.3 ${project.site_name} 인근 유사시설 현황`, 100.27, 127.67);
  addBulletHeading(slide, presentationConfig.facility_map_heading ?? `반경 ${Number(project.radius_m) / 1000}km 이내 문화·체육시설 현황`, 96.24, 161.28, 411.97);
  const mapFrame = { left: 95.99, top: 184.7, width: 446.68, height: 436.58 };
  addBaseMap(slide, mapFrame);
  const placed = [];
  for (const facility of facilities) addGeoMarker(slide, mapFrame, facility, FACILITY, placed);
  const columns = [579.82, 806.91];
  const rows = [184.65, 359.67, 534.07];
  facilities.forEach((facility, index) => {
    const frame = { left: columns[index % 2], top: rows[Math.floor(index / 2)], width: 219.08, height: index < 2 ? 159.75 : 159.33 };
    const extension = path.extname(facility.image.path).toLowerCase();
    const contentType = extension === ".png" ? "image/png" : "image/jpeg";
    slide.images.add({ blob: photoBytes.get(facility.name), contentType, alt: facility.name, fit: "cover", position: frame });
    shape(slide, "rect", frame, "none", { style: "solid", fill: WHITE, width: 1.1 }, `${facility.name} 사진 테두리`);
    const labelWidth = Math.min(frame.width - 4, Math.max(58, facility.name.length * 13 + 16));
    text(slide, facility.name, { left: frame.left, top: frame.top - 0.22, width: labelWidth, height: 22.17 }, {
      fontSize: 12, wrap: "none", insets: { left: 7.56, right: 7.56, top: 3.78, bottom: 3.78 },
    }, { fill: WHITE });
  });
  addBodyParagraphs(slide, config.narratives?.facility ?? defaultFacilityNarrative(),
    { left: 95.99, top: 626.21, width: 446.68, height: 56.3 });
  slide.speakerNotes.textFrame.setText([
    `시설 좌표: VWorld 주소 좌표 및 필지 검증 (${config.research_date ?? "조회일 미기재"})`,
    ...facilities.flatMap((item) => [
      `${item.name}: ${item.source_url}`,
      item.image?.source_url ? `${item.name} 사진: ${item.image.source_url}` : null,
    ].filter(Boolean)),
  ].join("\n"));
}

await fs.mkdir(path.dirname(finalPath), { recursive: true });
const stagingDir = path.join(workspaceDir, ".codex-finalizer");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, `${project.slug}_site_analysis_candidate.pptx`);
await (await PresentationFile.exportPptx(deck)).save(candidatePath);

const result = await finalizePresentation({
  explicitTotalSlideCount: 2,
  requiredNativeTableOwnerSlides: [1],
  requiredNativeChartOwnerSlides: [],
  workspaceDir, candidatePath, finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "10691813,7559675",
    "--validate-heading-fit", "--require-native-table-slide", "1",
  ],
  requiredNativeTableOwnerSlides: [1],
  fontPolicy: { basis: presentationConfig.font_basis ?? "design", families: [FONT_BOLD] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, `${path.basename(finalPath)}.validation.json`),
});

console.log(JSON.stringify({ finalPath: result.finalPath ?? finalPath }));
