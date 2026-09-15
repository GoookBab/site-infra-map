import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspaceDir = process.env.WORKSPACE_DIR;
const skillDir = process.env.PRESENTATIONS_SKILL_DIR;
const runtimePython = process.env.RUNTIME_PYTHON;
const finalPath = process.env.FINAL_PPTX;
const runtimeNodeModules = process.env.RUNTIME_NODE_MODULES;
if (![workspaceDir, skillDir, runtimePython, finalPath, runtimeNodeModules].every((v) => path.isAbsolute(v ?? ""))) {
  throw new Error("WORKSPACE_DIR, PRESENTATIONS_SKILL_DIR, RUNTIME_PYTHON, FINAL_PPTX, RUNTIME_NODE_MODULES must be absolute paths");
}

const { Presentation, PresentationFile } = await import(pathToFileURL(
  path.join(runtimeNodeModules, "@oai/artifact-tool/dist/artifact_tool.mjs"),
).href);

const { finalizePresentation } = await import(pathToFileURL(
  path.join(skillDir, "container_tools/artifact_tool_utils.mjs"),
).href);

const W = 1122.5000524934383;
const H = 793.6666666666666;
const FONT = "페이퍼로지 4 Regular";
const FONT_MEDIUM = "페이퍼로지 5 Medium";
const FONT_SEMIBOLD = "페이퍼로지 6 SemiBold";
const FONT_BOLD = "페이퍼로지 7 Bold";
const BLACK = "#111111";
const GRAY = "#666666";
const LIGHT = "#E5E5E5";
const WHITE = "#FFFFFF";
const SITE = "#E53935";
const ELEMENTARY = "#F5C04A";
const MIDDLE = "#4A90E2";
const HIGH = "#8E6CCB";
const SPECIAL = "#67A86B";
const FACILITY = "#F07B42";

const overview = JSON.parse(await fs.readFile(path.join(workspaceDir, "outputs/satellite_overview.json"), "utf8"));
const geocoded = {
  "송파청소년센터": { longitude: 127.11130129401982, latitude: 37.48970600332086 },
  "송파구배드민턴체육관": { longitude: 127.13826992451659, latitude: 37.49371152379616 },
  "송파글마루도서관": { longitude: 127.13042792882896, latitude: 37.480847041371106 },
  "메가박스 송파파크하비오": { longitude: 127.12365274465071, latitude: 37.4792080798004 },
  "가든파이브 라이프": { longitude: 127.12511923390264, latitude: 37.477713584444004 },
};
const mapBytes = await fs.readFile(path.join(workspaceDir, "outputs/satellite_base_overview.png"));
const asset = (name) => path.join(workspaceDir, "assets/facilities", name);
const photoBytes = Object.fromEntries(await Promise.all([
  ["문정근린공원", "munjeong_park.jpg"],
  ["송파청소년센터", "songpa_youth.jpg"],
  ["송파구배드민턴체육관", "badminton.jpg"],
  ["송파글마루도서관", "geulmaru_library.jpg"],
  ["메가박스 송파파크하비오", "megabox_parkhabio.jpg"],
  ["가든파이브 라이프", "garden5.jpg"],
].map(async ([label, file]) => [label, await fs.readFile(asset(file))])));

const deck = Presentation.create({ slideSize: { width: W, height: H } });

function shape(slide, geometry, position, fill = "none", line = { fill: "none", width: 0 }, name) {
  return slide.shapes.add({ geometry, position, fill, line, name });
}

function text(slide, value, position, style = {}, opts = {}) {
  const box = shape(slide, "textbox", position, opts.fill ?? "none", opts.line ?? { fill: "none", width: 0 }, opts.name);
  box.text = value;
  box.text.style = {
    typeface: style.typeface ?? FONT,
    fontSize: style.fontSize ?? 14,
    color: style.color ?? BLACK,
    bold: false,
    autoFit: style.autoFit ?? "none",
    wrap: style.wrap ?? "square",
    insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "top",
    ...style,
    bold: false,
  };
  return box;
}

function addTitle(slide, subtitle, titleY, subtitleY) {
  text(slide, "1.  지역사회 및 주변현황", { left: 96.25, top: titleY, width: 260, height: 19.39 }, {
    typeface: FONT_BOLD, fontSize: 16, color: BLACK, wrap: "none",
  });
  text(slide, subtitle, { left: 96.25, top: subtitleY, width: 420, height: 21.81 }, {
    typeface: FONT_BOLD, fontSize: 14, color: BLACK, wrap: "none",
  });
}

function addBulletHeading(slide, label, x, y, width) {
  shape(slide, "ellipse", { left: x, top: y + 8, width: 5, height: 5 }, BLACK, { fill: "none", width: 0 });
  text(slide, label, { left: x + 11, top: y, width: width - 11, height: 16.16 }, {
    typeface: FONT_BOLD, fontSize: 13.333, color: BLACK,
  });
}

function addBodyParagraphs(slide, paragraphs, position) {
  const box = shape(slide, "textbox", position, "none", { fill: "none", width: 0 }, "본문 설명");
  box.text.set(paragraphs.map((paragraph) => ({
    bulletCharacter: "-",
    marginLeft: 18,
    indent: -18,
    spaceAfter: 4,
    runs: [paragraph],
  })));
  box.text.style = {
    typeface: FONT_BOLD,
    fontSize: 10.667,
    color: BLACK,
    bold: false,
    alignment: "justify",
    verticalAlignment: "top",
    autoFit: "none",
    wrap: "square",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return box;
}

function worldPixel(lon, lat, zoom = 16) {
  const size = 256 * 2 ** zoom;
  const x = (lon + 180) / 360 * size;
  const sin = Math.sin(lat * Math.PI / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size;
  return { x, y };
}

const siteWorld = worldPixel(overview.features[0].longitude, overview.features[0].latitude, overview.zoom);
const origin = { x: siteWorld.x - overview.site_x, y: siteWorld.y - overview.site_y };
function geoToSource(lon, lat) {
  const p = worldPixel(lon, lat, overview.zoom);
  return { x: p.x - origin.x, y: p.y - origin.y };
}

function mapTransform(frame, p) {
  const scale = Math.max(frame.width / overview.width, frame.height / overview.height);
  const drawnW = overview.width * scale;
  const drawnH = overview.height * scale;
  return {
    x: frame.left + (frame.width - drawnW) / 2 + p.x * scale,
    y: frame.top + (frame.height - drawnH) / 2 + p.y * scale,
    scale,
  };
}

function addBaseMap(slide, frame) {
  slide.images.add({
    blob: mapBytes,
    contentType: "image/png",
    alt: "서울특별시 송파구 법원로8길 8 주변 VWorld 위성지도",
    fit: "cover",
    position: frame,
  });
  shape(slide, "rect", frame, "none", { style: "solid", fill: "#B9B9B9", width: 0.7 }, "지도 테두리");
  const site = mapTransform(frame, { x: overview.site_x, y: overview.site_y });
  const radiusPx = overview.search_radius_m / overview.meters_per_pixel;
  shape(slide, "ellipse", {
    left: site.x - radiusPx * site.scale,
    top: site.y - radiusPx * site.scale,
    width: radiusPx * site.scale * 2,
    height: radiusPx * site.scale * 2,
  }, "none", { style: "solid", fill: WHITE, width: 2.2 }, "반경 2km");
  shape(slide, "ellipse", { left: site.x - 6, top: site.y - 6, width: 12, height: 12 }, SITE,
    { style: "solid", fill: WHITE, width: 1.6 }, "대상지 위치");
  text(slide, "대상지", { left: site.x + 7, top: site.y - 12, width: 46, height: 18 }, {
    typeface: FONT_BOLD, fontSize: 9.333, color: WHITE, verticalAlignment: "middle",
  }, { fill: "#111111CC", name: "대상지 라벨" });
  text(slide, "N", { left: frame.left + frame.width - 36, top: frame.top + 10, width: 22, height: 17 }, {
    typeface: FONT_BOLD, fontSize: 13.333, color: WHITE, alignment: "center",
  });
  shape(slide, "triangle", { left: frame.left + frame.width - 32, top: frame.top + 27, width: 14, height: 18 }, BLACK,
    { style: "solid", fill: WHITE, width: 0.6 }, "북쪽 화살표");
  text(slide, "2km", { left: frame.left + 11, top: frame.top + frame.height - 28, width: 34, height: 17 }, {
    typeface: FONT_BOLD, fontSize: 13.333, color: WHITE, alignment: "center",
  }, { fill: "#111111C8", name: "반경 표기" });
}

function addGeoMarker(slide, frame, item, color, placed, fontSize = 7.8) {
  const src = geoToSource(item.lon, item.lat);
  const pt = mapTransform(frame, src);
  shape(slide, "ellipse", { left: pt.x - 3.6, top: pt.y - 3.6, width: 7.2, height: 7.2 }, color,
    { style: "solid", fill: WHITE, width: 0.8 }, `${item.name} 위치`);
  const label = item.short ?? item.name;
  const width = Math.min(80, Math.max(28, label.length * (fontSize + 0.5)));
  const height = 14;
  const candidates = [
    [5, -15], [5, 2], [-width - 5, -15], [-width - 5, 2], [5, -30], [-width - 5, -30],
  ];
  let selected = { left: pt.x + 5, top: pt.y - 15 };
  for (const [dx, dy] of candidates) {
    const r = { left: pt.x + dx, top: pt.y + dy, right: pt.x + dx + width, bottom: pt.y + dy + height };
    const inside = r.left > frame.left + 2 && r.right < frame.left + frame.width - 2 && r.top > frame.top + 2 && r.bottom < frame.top + frame.height - 2;
    const collision = placed.some((q) => !(r.right < q.left || r.left > q.right || r.bottom < q.top || r.top > q.bottom));
    if (inside && !collision) { selected = r; placed.push(r); break; }
  }
  text(slide, label, { left: selected.left, top: selected.top, width, height }, {
    typeface: FONT_BOLD, fontSize, color: BLACK, verticalAlignment: "middle", autoFit: "shrinkText", wrap: "none",
  }, { fill: "#FFFFFFDD", line: { style: "solid", fill: "#FFFFFF", width: 0.35 }, name: `${item.name} 라벨` });
}

const schools = [
  { name: "서울문덕초등학교", short: "문덕초", type: "초", count: 434, lon: 127.1279628, lat: 37.4850521 },
  { name: "서울문현초등학교", short: "문현초", type: "초", count: 670, lon: 127.1302929, lat: 37.4826633 },
  { name: "서울문정초등학교", short: "문정초", type: "초", count: 747, lon: 127.1292064, lat: 37.4890773 },
  { name: "서울평화초등학교", short: "평화초", type: "초", count: 153, lon: 127.1223230, lat: 37.4913760 },
  { name: "서울가원초등학교", short: "가원초", type: "초", count: 552, lon: 127.1114082, lat: 37.4890463 },
  { name: "서울가주초등학교", short: "가주초", type: "초", count: 708, lon: 127.1288653, lat: 37.4965113 },
  { name: "서울송례초등학교", short: "송례초", type: "초", count: 1219, lon: 127.1385565, lat: 37.4777581 },
  { name: "서울율현초등학교", short: "율현초", type: "초", count: 795, lon: 127.1083072, lat: 37.4745768 },
  { name: "문현중학교", short: "문현중", type: "중", count: 508, lon: 127.1278834, lat: 37.4806128 },
  { name: "가원중학교", short: "가원중", type: "중", count: 441, lon: 127.1228160, lat: 37.4907940 },
  { name: "문정중학교", short: "문정중", type: "중", count: 452, lon: 127.1302858, lat: 37.4883924 },
  { name: "송파중학교", short: "송파중", type: "중", count: 804, lon: 127.1299159, lat: 37.4955536 },
  { name: "송례중학교", short: "송례중", type: "중", count: 1140, lon: 127.1398102, lat: 37.4777185 },
  { name: "문정고등학교", short: "문정고", type: "고", count: 768, lon: 127.1266033, lat: 37.4851714 },
  { name: "문현고등학교", short: "문현고", type: "고", count: 574, lon: 127.1289544, lat: 37.4811226 },
  { name: "한국육영학교", short: "한국육영", type: "특수", count: 192, lon: 127.1324929, lat: 37.4817802 },
];
const schoolColor = { 초: ELEMENTARY, 중: MIDDLE, 고: HIGH, 특수: SPECIAL };

const facilities = [
  { name: "문정근린공원", short: "문정근린공원", lon: 127.13426080524212, lat: 37.49079167101516 },
  { name: "송파청소년센터", short: "송파청소년센터", lon: geocoded["송파청소년센터"].longitude, lat: geocoded["송파청소년센터"].latitude },
  { name: "송파구배드민턴체육관", short: "배드민턴체육관", lon: geocoded["송파구배드민턴체육관"].longitude, lat: geocoded["송파구배드민턴체육관"].latitude },
  { name: "송파글마루도서관", short: "글마루도서관", lon: geocoded["송파글마루도서관"].longitude, lat: geocoded["송파글마루도서관"].latitude },
  { name: "메가박스 송파파크하비오", short: "메가박스 파크하비오", lon: geocoded["메가박스 송파파크하비오"].longitude, lat: geocoded["메가박스 송파파크하비오"].latitude },
  { name: "가든파이브 라이프", short: "가든파이브 라이프", lon: geocoded["가든파이브 라이프"].longitude, lat: geocoded["가든파이브 라이프"].latitude },
];

// Slide 1 — school catchment and editable table
{
  const slide = deck.slides.add();
  slide.background.fill = WHITE;
  addTitle(slide, "1.2 문정동 대상지 예상 이용자 현황", 134.59, 162);
  addBulletHeading(slide, "반경 2km 이내 학교 현황", 96.5, 195.6, 411.97);
  addBulletHeading(slide, "이용가능한 인근 학교 학생 현황", 580.08, 195.6, 411.97);
  const mapFrame = { left: 96, top: 218.5, width: 446.7, height: 436.6 };
  addBaseMap(slide, mapFrame);
  const placed = [];
  for (const school of schools) addGeoMarker(slide, mapFrame, school, schoolColor[school.type], placed, 9.333);

  const left = schools.slice(0, 8);
  const right = schools.slice(8, 16);
  const values = [
    ["구분", "학교명", "학생수", "구분", "학교명", "학생수"],
    ...left.map((item, i) => [item.type, item.name.replace("서울", ""), `${item.count.toLocaleString("ko-KR")}명`, right[i].type, right[i].name, `${right[i].count.toLocaleString("ko-KR")}명`]),
    ["초등", "소계", "5,278명", "중·고·특수", "소계", "4,879명"],
  ];
  const table = slide.tables.add({
    rows: values.length, columns: 6,
    left: 579.57, top: 218.5, width: 446.68, height: 307.27,
    columnWidths: [38, 113, 68, 46, 113, 68], values,
  });
  table.borders.assign({ style: "solid", fill: "#B7B7B7", width: 0.65 });
  table.cells.block({ row: 0, column: 0, rowCount: 1, columnCount: 6 }).assign({
    fill: "#6E747A", textStyle: { typeface: FONT_BOLD, fontSize: 10.667, bold: false, color: WHITE, alignment: "center" },
    margins: { left: 3, right: 3, top: 3, bottom: 3 },
  });
  table.cells.block({ row: 1, column: 0, rowCount: 8, columnCount: 6 }).assign({
    textStyle: { typeface: FONT_BOLD, fontSize: 9.333, color: BLACK, alignment: "center" },
    margins: { left: 3, right: 3, top: 2.5, bottom: 2.5 },
  });
  for (let r = 1; r <= 8; r += 1) {
    table.getCell(r, 0).fill = "#FFF1C8";
    const rightFill = right[r - 1].type === "중" ? "#DCEEFF" : right[r - 1].type === "고" ? "#E8DFF6" : "#DDEEDC";
    table.getCell(r, 3).fill = rightFill;
    if (r % 2 === 0) {
      table.getCell(r, 1).fill = "#F7F7F7"; table.getCell(r, 2).fill = "#F7F7F7";
      table.getCell(r, 4).fill = "#F7F7F7"; table.getCell(r, 5).fill = "#F7F7F7";
    }
  }
  table.cells.block({ row: 9, column: 0, rowCount: 1, columnCount: 6 }).assign({
    fill: "#E9E9E9", textStyle: { typeface: FONT_BOLD, fontSize: 9.333, bold: false, color: BLACK, alignment: "center" },
    margins: { left: 3, right: 3, top: 3, bottom: 3 },
  });
  addBodyParagraphs(slide, [
    "반경 2km 내 학교 중 학교알리미 재학생 수를 확인한 16개교는 총 10,157명이다. 초등학생 5,278명(52.0%)이 가장 큰 비중을 차지하며, 중학생 3,345명, 고등학생 1,342명, 특수학교 192명으로 집계된다.",
    "대상지는 문정고·문덕초와 약 0.5km, 문현중·문현고와 약 0.7km 이내에 있다. 초등 중심의 일상 이용과 중·고등학생의 방과 후·주말 이용을 함께 고려할 수 있는 입지다.",
  ], { left: 579.57, top: 525.23, width: 446.68, height: 133.85 });
  slide.speakerNotes.textFrame.setText([
    "지도·좌표: VWorld 위성지도 및 주소 좌표, OpenStreetMap 학교 객체(2026-09-15 조회)",
    "학교 재학생 수: 학교알리미 학교별 공시(2026-09-15 조회)",
    "https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=fe13bdd6-7a2e-404e-bcae-cef07c1eb1ec",
    "https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=bbbbaae3-82ef-4e87-951d-3fb08d4e9932",
    "https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=b5966193-042c-4a0d-b07c-e059b5caccd6",
    "https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=06e2f7ba-2ba8-4a16-bc27-0fcbf1098173",
    "학생 수 합계는 위 공시값을 포함한 16개교 값을 합산함.",
  ].join("\n"));
}

// Slide 2 — similar facilities and image matrix
{
  const slide = deck.slides.add();
  slide.background.fill = WHITE;
  addTitle(slide, "1.3 문정동 대상지 인근 유사시설 현황", 100.27, 127.67);
  addBulletHeading(slide, "반경 2km 이내 문화·체육시설 현황", 96.24, 161.28, 411.97);
  const mapFrame = { left: 95.99, top: 184.7, width: 446.68, height: 436.58 };
  addBaseMap(slide, mapFrame);
  const placed = [];
  for (const facility of facilities) addGeoMarker(slide, mapFrame, facility, FACILITY, placed, 9.333);

  const columns = [579.82, 806.91];
  const rows = [184.65, 359.67, 534.07];
  facilities.forEach((facility, i) => {
    const frame = { left: columns[i % 2], top: rows[Math.floor(i / 2)], width: 219.08, height: i < 2 ? 159.75 : 159.33 };
    slide.images.add({ blob: photoBytes[facility.name], contentType: "image/jpeg", alt: facility.name, fit: "cover", position: frame });
    shape(slide, "rect", frame, "none", { style: "solid", fill: WHITE, width: 1.1 }, `${facility.name} 사진 테두리`);
    const labelWidth = Math.min(frame.width - 4, Math.max(58, facility.name.length * 13 + 16));
    text(slide, facility.name, { left: frame.left, top: frame.top - 0.22, width: labelWidth, height: 22.17 }, {
      typeface: FONT_BOLD, fontSize: 12, color: BLACK, wrap: "none",
      insets: { left: 7.56, right: 7.56, top: 3.78, bottom: 3.78 },
    }, { fill: WHITE, name: `${facility.name} 사진 라벨` });
  });

  addBodyParagraphs(slide, [
    "대상지 반경 2km에는 문정근린공원, 송파글마루도서관, 송파청소년센터, 송파구배드민턴체육관 등 공공 여가시설과 파크하비오·가든파이브 문화시설이 분포한다. 공공 여가시설은 동·북동 생활권에, 대형 상업문화시설은 남·남동 장지역 생활권에 집중되어 있다.",
  ], { left: 95.99, top: 626.21, width: 446.68, height: 56.3 });

  slide.speakerNotes.textFrame.setText([
    "시설 좌표: VWorld 도로명주소 좌표 및 필지 검증 좌표(2026-09-15 조회)",
    "문정근린공원 사진: https://parks.seoul.go.kr/file/info/view.do?fIdx=1537",
    "송파청소년센터: https://www.songpa.go.kr/learn/songpacenter/place/intro.do",
    "송파청소년센터 사진 출처: https://www.nocutnews.co.kr/news/5369882",
    "송파구배드민턴체육관: https://sports.seoul.go.kr/main/facilities/facilities_view.do?ft_idx=971",
    "송파글마루도서관 사진 출처: https://www.chosun.com/site/data/html_dir/2016/04/06/2016040600122.html?outputType=amp",
    "메가박스 송파파크하비오: https://m.megabox.co.kr/theater?areaCd=10&brchNo=1381",
    "가든파이브 라이프: https://www.songpa.go.kr/culture/detailInfo.do?key=5111&rcpp=6&resrceCd=TR0180-1002536&sc1=TR0180",
  ].join("\n"));
}

await fs.mkdir(path.dirname(finalPath), { recursive: true });
const stagingDir = path.join(workspaceDir, ".codex-finalizer");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "munjeong_reference_style_candidate.pptx");
await (await PresentationFile.exportPptx(deck)).save(candidatePath);

const result = await finalizePresentation({
  explicitTotalSlideCount: 2,
  requiredNativeTableOwnerSlides: [1],
  requiredNativeChartOwnerSlides: [],
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "10691813,7559675",
    "--validate-heading-fit",
    "--require-native-table-slide", "1",
  ],
  requiredNativeTableOwnerSlides: [1],
  fontPolicy: { basis: "user_request", families: [FONT_BOLD] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, `${path.basename(finalPath)}.validation.json`),
});

console.log(JSON.stringify({ finalPath: result.finalPath ?? finalPath }));
