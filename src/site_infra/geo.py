from __future__ import annotations

import math
from collections.abc import Iterable
from typing import Any


EARTH_RADIUS_M = 6_371_008.8
WEB_MERCATOR_RADIUS_M = 6_378_137.0


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def to_web_mercator(lon: float, lat: float) -> tuple[float, float]:
    """EPSG:4326을 위성 타일에서 널리 쓰는 EPSG:3857로 변환한다."""
    lat = max(min(lat, 85.05112878), -85.05112878)
    x = WEB_MERCATOR_RADIUS_M * math.radians(lon)
    y = WEB_MERCATOR_RADIUS_M * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def _rings(geometry: dict[str, Any]) -> Iterable[list[list[float]]]:
    kind = geometry.get("type")
    coords = geometry.get("coordinates") or []
    if kind == "Polygon":
        yield from coords
    elif kind == "MultiPolygon":
        for polygon in coords:
            yield from polygon


def _inside_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    if len(ring) < 3:
        return False
    j = len(ring) - 1
    for i, (xi, yi, *_) in enumerate(ring):
        xj, yj, *_ = ring[j]
        crosses = (yi > lat) != (yj > lat)
        if crosses:
            x_cross = (xj - xi) * (lat - yi) / (yj - yi) + xi
            if lon < x_cross:
                inside = not inside
        j = i
    return inside


def point_in_geometry(lon: float, lat: float, geometry: dict[str, Any] | None) -> bool:
    if not geometry:
        return False
    rings = list(_rings(geometry))
    if not rings:
        return False
    # 외곽 링 안에 있고 내부 구멍에는 없어야 한다. MultiPolygon은 각 외곽 링을
    # 완전히 구분하기 어려우므로 GeoJSON 구조를 보존해 유형별로 처리한다.
    if geometry.get("type") == "Polygon":
        return _inside_ring(lon, lat, rings[0]) and not any(
            _inside_ring(lon, lat, hole) for hole in rings[1:]
        )
    for polygon in geometry.get("coordinates") or []:
        if polygon and _inside_ring(lon, lat, polygon[0]) and not any(
            _inside_ring(lon, lat, hole) for hole in polygon[1:]
        ):
            return True
    return False

