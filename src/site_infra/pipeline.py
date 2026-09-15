from __future__ import annotations

import sqlite3

from .db import mark_not_found, save_geocode
from .geo import haversine_m, point_in_geometry
from .models import Accuracy
from .vworld import VWorldClient


def geocode_pending(
    conn: sqlite3.Connection,
    client: VWorldClient,
    site_lon: float,
    site_lat: float,
    radius_m: float,
) -> dict[str, int]:
    stats = {"processed": 0, "verified": 0, "review": 0, "not_found": 0}
    rows = conn.execute(
        "SELECT id, normalized_address FROM facilities WHERE accuracy IN ('unprocessed', 'not_found')"
    ).fetchall()
    for row in rows:
        result = client.geocode(row["normalized_address"])
        stats["processed"] += 1
        if result is None:
            mark_not_found(conn, row["id"])
            stats["not_found"] += 1
            continue
        parcel = client.parcel(result.longitude, result.latitude, result.pnu)
        if parcel.pnu and not result.pnu:
            result.pnu = parcel.pnu
        if parcel.geometry:
            verified = point_in_geometry(result.longitude, result.latitude, parcel.geometry)
            accuracy = Accuracy.PARCEL_VERIFIED if verified else Accuracy.REVIEW_REQUIRED
        else:
            accuracy = Accuracy.ADDRESS_MATCHED
        distance = haversine_m(site_lon, site_lat, result.longitude, result.latitude)
        save_geocode(
            conn, row["id"], result, accuracy, distance, distance <= radius_m, parcel.geometry
        )
        if accuracy is Accuracy.PARCEL_VERIFIED:
            stats["verified"] += 1
        elif accuracy is Accuracy.REVIEW_REQUIRED:
            stats["review"] += 1
    return stats

