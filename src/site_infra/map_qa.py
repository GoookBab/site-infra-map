from __future__ import annotations

import json
import math
import sqlite3
import urllib.request
from io import BytesIO
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


TILE_SIZE = 256


def world_pixel(longitude: float, latitude: float, zoom: int) -> tuple[float, float]:
    """WGS84 좌표를 Web Mercator WMTS 전역 픽셀 좌표로 변환한다."""
    latitude = max(-85.05112878, min(85.05112878, latitude))
    scale = TILE_SIZE * (2**zoom)
    x = (longitude + 180.0) / 360.0 * scale
    sin_lat = math.sin(math.radians(latitude))
    y = (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * scale
    return x, y


def _font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def _download_tile(key: str, zoom: int, x: int, y: int, cache_dir: Path) -> Image.Image:
    path = cache_dir / str(zoom) / str(x) / f"{y}.jpeg"
    if path.exists():
        return Image.open(path).convert("RGB")
    path.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://api.vworld.kr/req/wmts/1.0.0/{key}/Satellite/{zoom}/{y}/{x}.jpeg"
    request = urllib.request.Request(url, headers={"User-Agent": "site-infra-qa/0.1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read()
    tile = Image.open(BytesIO(payload)).convert("RGB")
    tile.save(path, "JPEG", quality=92)
    return tile


def _rings(geometry: dict | None) -> Iterable[list[list[float]]]:
    if not geometry:
        return
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates", [])
    polygons = [coordinates] if kind == "Polygon" else coordinates if kind == "MultiPolygon" else []
    for polygon in polygons:
        for ring in polygon:
            yield ring


def render_satellite_qa(
    conn: sqlite3.Connection,
    key: str,
    output: str | Path,
    cache_dir: str | Path = "data/cache/vworld/satellite",
    zoom: int = 16,
    view_radius_m: float | None = None,
) -> Path:
    site = conn.execute("SELECT * FROM sites ORDER BY updated_at DESC LIMIT 1").fetchone()
    if site is None:
        raise ValueError("먼저 set-site 명령으로 대상지를 등록해야 합니다.")

    radius_m = float(site["radius_m"])
    extent_m = float(view_radius_m or radius_m)
    lat = float(site["latitude"])
    lon = float(site["longitude"])
    lat_delta = extent_m / 111_320.0
    lon_delta = extent_m / (111_320.0 * math.cos(math.radians(lat)))
    west, east = lon - lon_delta, lon + lon_delta
    south, north = lat - lat_delta, lat + lat_delta
    left_px, top_px = world_pixel(west, north, zoom)
    right_px, bottom_px = world_pixel(east, south, zoom)
    min_x, max_x = math.floor(left_px / TILE_SIZE), math.floor(right_px / TILE_SIZE)
    min_y, max_y = math.floor(top_px / TILE_SIZE), math.floor(bottom_px / TILE_SIZE)

    mosaic = Image.new(
        "RGB",
        ((max_x - min_x + 1) * TILE_SIZE, (max_y - min_y + 1) * TILE_SIZE),
    )
    cache = Path(cache_dir)
    for tile_x in range(min_x, max_x + 1):
        for tile_y in range(min_y, max_y + 1):
            tile = _download_tile(key, zoom, tile_x, tile_y, cache)
            mosaic.paste(tile, ((tile_x - min_x) * TILE_SIZE, (tile_y - min_y) * TILE_SIZE))

    origin_x, origin_y = min_x * TILE_SIZE, min_y * TILE_SIZE
    crop_box = (
        round(left_px - origin_x), round(top_px - origin_y),
        round(right_px - origin_x), round(bottom_px - origin_y),
    )
    image = mosaic.crop(crop_box).convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")

    def local_point(point_lon: float, point_lat: float) -> tuple[float, float]:
        px, py = world_pixel(point_lon, point_lat, zoom)
        return px - left_px, py - top_px

    meters_per_pixel = (
        math.cos(math.radians(lat)) * 2 * math.pi * 6_378_137 / (TILE_SIZE * 2**zoom)
    )
    cx, cy = local_point(lon, lat)
    radius_px = radius_m / meters_per_pixel
    draw.ellipse(
        (cx - radius_px, cy - radius_px, cx + radius_px, cy + radius_px),
        outline=(255, 225, 50, 230), width=4,
    )

    rows = list(conn.execute(
        "SELECT * FROM facilities WHERE longitude IS NOT NULL ORDER BY distance_m, name"
    ))
    features = [(site, True)] + [(row, False) for row in rows]
    for row, is_site in features:
        geometry = json.loads(row["parcel_geojson"]) if row["parcel_geojson"] else None
        color = (255, 70, 60, 245) if is_site else (50, 220, 255, 230)
        for ring in _rings(geometry):
            points = [local_point(float(coord[0]), float(coord[1])) for coord in ring]
            if len(points) >= 2:
                draw.line(points, fill=color, width=5 if is_site else 3, joint="curve")

    label_font = _font(24, bold=True)
    small_font = _font(19)
    placed_labels: list[tuple[float, float, float, float]] = []
    for row, is_site in features:
        x, y = local_point(float(row["longitude"]), float(row["latitude"]))
        if not (-30 <= x <= image.width + 30 and -30 <= y <= image.height + 30):
            continue
        inside = True if is_site else bool(row["within_radius"])
        fill = (255, 65, 55, 255) if is_site else (
            (60, 220, 255, 255) if inside else (180, 180, 180, 255)
        )
        r = 13 if is_site else 10
        draw.ellipse((x - r - 3, y - r - 3, x + r + 3, y + r + 3), fill=(0, 0, 0, 190))
        draw.ellipse((x - r, y - r, x + r, y + r), fill=fill, outline=(255, 255, 255, 255), width=2)
        name = "대상지" if is_site else str(row["name"])
        distance = "" if is_site else f"  {float(row['distance_m']):.0f}m"
        text = name + distance
        bbox = draw.textbbox((0, 0), text, font=label_font)
        text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        candidates = [
            (x + 17, y - text_h - 8), (x + 17, y + 10),
            (x - text_w - 25, y - text_h - 8), (x - text_w - 25, y + 10),
        ]
        tx, ty = candidates[0]
        for candidate_x, candidate_y in candidates:
            rect = (candidate_x - 7, candidate_y - 5, candidate_x + text_w + 7,
                    candidate_y + text_h + 10)
            in_frame = 0 <= rect[0] and rect[2] <= image.width and 0 <= rect[1] and rect[3] <= image.height
            overlaps = any(
                not (rect[2] < old[0] or rect[0] > old[2] or rect[3] < old[1] or rect[1] > old[3])
                for old in placed_labels
            )
            if in_frame and not overlaps:
                tx, ty = candidate_x, candidate_y
                break
        label_rect = (tx - 7, ty - 5, tx + text_w + 7, ty + text_h + 10)
        placed_labels.append(label_rect)
        draw.rounded_rectangle(
            label_rect,
            radius=5, fill=(0, 0, 0, 175),
        )
        draw.text((tx, ty), text, font=label_font, fill=(255, 255, 255, 255))

    title = f"위성영상 좌표 QA · 검색반경 {radius_m / 1000:g}km · zoom {zoom}"
    draw.rounded_rectangle((24, 22, 610, 94), radius=10, fill=(0, 0, 0, 190))
    draw.text((42, 32), title, font=label_font, fill=(255, 255, 255, 255))
    subtitle = "빨강: 대상지 필지 · 청록: 시설 필지 · 노랑: 검색 반경"
    if extent_m != radius_m:
        subtitle += f" · 화면 ±{extent_m:g}m"
    draw.text(
        (42, 66), subtitle,
        font=small_font, fill=(235, 235, 235, 255),
    )

    destination = Path(output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(destination, "PNG", optimize=True)
    return destination
