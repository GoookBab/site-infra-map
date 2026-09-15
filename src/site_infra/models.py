from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class Accuracy(StrEnum):
    PARCEL_VERIFIED = "parcel_verified"
    ADDRESS_MATCHED = "address_matched"
    REVIEW_REQUIRED = "review_required"
    NOT_FOUND = "not_found"


@dataclass(slots=True)
class ResearchFacility:
    name: str
    category: str
    address: str
    source_url: str = ""


@dataclass(slots=True)
class GeocodeResult:
    normalized_address: str
    longitude: float
    latitude: float
    coordinate_source: str
    raw: dict[str, Any]
    pnu: str | None = None
    building_id: str | None = None


@dataclass(slots=True)
class ParcelResult:
    pnu: str | None
    geometry: dict[str, Any] | None
    raw: dict[str, Any]

