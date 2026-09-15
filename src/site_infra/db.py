from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any

from .geo import to_web_mercator
from .models import Accuracy, GeocodeResult, ResearchFacility
from .normalize import normalize_address


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    searched_address TEXT NOT NULL,
    normalized_address TEXT NOT NULL,
    longitude REAL NOT NULL,
    latitude REAL NOT NULL,
    web_mercator_x REAL NOT NULL,
    web_mercator_y REAL NOT NULL,
    pnu TEXT,
    coordinate_source TEXT NOT NULL,
    accuracy TEXT NOT NULL,
    radius_m REAL NOT NULL,
    parcel_geojson TEXT,
    raw_geocode_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    searched_address TEXT NOT NULL,
    normalized_address TEXT NOT NULL,
    source_url TEXT NOT NULL DEFAULT '',
    longitude REAL,
    latitude REAL,
    web_mercator_x REAL,
    web_mercator_y REAL,
    pnu TEXT,
    building_id TEXT,
    anchor_type TEXT NOT NULL DEFAULT 'address_point',
    coordinate_source TEXT,
    accuracy TEXT NOT NULL DEFAULT 'unprocessed',
    distance_m REAL,
    within_radius INTEGER,
    parcel_geojson TEXT,
    raw_geocode_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_facilities_category ON facilities(category);
CREATE INDEX IF NOT EXISTS idx_facilities_pnu ON facilities(pnu);
CREATE INDEX IF NOT EXISTS idx_facilities_coords ON facilities(longitude, latitude);
"""


def connect(path: str | Path) -> sqlite3.Connection:
    db_path = Path(path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def facility_id(name: str, address: str) -> str:
    key = f"{name.strip()}|{normalize_address(address)}".encode("utf-8")
    return hashlib.sha256(key).hexdigest()[:24]


def upsert_research(conn: sqlite3.Connection, item: ResearchFacility) -> str:
    key = facility_id(item.name, item.address)
    conn.execute(
        """
        INSERT INTO facilities(id, name, category, searched_address, normalized_address, source_url)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          category=excluded.category,
          source_url=excluded.source_url,
          updated_at=CURRENT_TIMESTAMP
        """,
        (key, item.name.strip(), item.category.strip(), item.address.strip(),
         normalize_address(item.address), item.source_url.strip()),
    )
    conn.commit()
    return key


def save_geocode(
    conn: sqlite3.Connection,
    facility_key: str,
    result: GeocodeResult,
    accuracy: Accuracy,
    distance_m: float,
    within_radius: bool,
    parcel_geometry: dict[str, Any] | None,
) -> None:
    x, y = to_web_mercator(result.longitude, result.latitude)
    conn.execute(
        """
        UPDATE facilities SET
          normalized_address=?, longitude=?, latitude=?, web_mercator_x=?, web_mercator_y=?,
          pnu=?, building_id=?, coordinate_source=?, accuracy=?, distance_m=?, within_radius=?,
          parcel_geojson=?, raw_geocode_json=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
        """,
        (
            result.normalized_address, result.longitude, result.latitude, x, y,
            result.pnu, result.building_id, result.coordinate_source, accuracy.value,
            distance_m, int(within_radius),
            json.dumps(parcel_geometry, ensure_ascii=False) if parcel_geometry else None,
            json.dumps(result.raw, ensure_ascii=False), facility_key,
        ),
    )
    conn.commit()


def mark_not_found(conn: sqlite3.Connection, facility_key: str) -> None:
    conn.execute(
        "UPDATE facilities SET accuracy=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (Accuracy.NOT_FOUND.value, facility_key),
    )
    conn.commit()


def upsert_site(
    conn: sqlite3.Connection,
    searched_address: str,
    result: GeocodeResult,
    accuracy: Accuracy,
    radius_m: float,
    parcel_geometry: dict[str, Any] | None,
) -> str:
    key = hashlib.sha256(normalize_address(searched_address).encode("utf-8")).hexdigest()[:24]
    x, y = to_web_mercator(result.longitude, result.latitude)
    conn.execute(
        """
        INSERT INTO sites(
          id, searched_address, normalized_address, longitude, latitude,
          web_mercator_x, web_mercator_y, pnu, coordinate_source, accuracy,
          radius_m, parcel_geojson, raw_geocode_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          normalized_address=excluded.normalized_address,
          longitude=excluded.longitude, latitude=excluded.latitude,
          web_mercator_x=excluded.web_mercator_x,
          web_mercator_y=excluded.web_mercator_y,
          pnu=excluded.pnu, coordinate_source=excluded.coordinate_source,
          accuracy=excluded.accuracy, radius_m=excluded.radius_m,
          parcel_geojson=excluded.parcel_geojson,
          raw_geocode_json=excluded.raw_geocode_json,
          updated_at=CURRENT_TIMESTAMP
        """,
        (
            key, searched_address, result.normalized_address, result.longitude,
            result.latitude, x, y, result.pnu, result.coordinate_source,
            accuracy.value, radius_m,
            json.dumps(parcel_geometry, ensure_ascii=False) if parcel_geometry else None,
            json.dumps(result.raw, ensure_ascii=False),
        ),
    )
    conn.commit()
    return key
