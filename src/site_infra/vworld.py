from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .models import GeocodeResult, ParcelResult


class VWorldError(RuntimeError):
    pass


@dataclass(slots=True)
class VWorldClient:
    api_key: str
    domain: str = "http://localhost"
    timeout: float = 20.0

    def _get(self, endpoint: str, params: dict[str, Any]) -> dict[str, Any]:
        safe_params = {k: v for k, v in params.items() if v is not None}
        url = f"{endpoint}?{urlencode(safe_params)}"
        req = Request(url, headers={"User-Agent": "site-infra-db/0.1"})
        with urlopen(req, timeout=self.timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    def geocode(self, address: str) -> GeocodeResult | None:
        for address_type in ("ROAD", "PARCEL"):
            payload = self._get(
                "https://api.vworld.kr/req/address",
                {
                    "service": "address",
                    "request": "getcoord",
                    "version": "2.0",
                    "crs": "EPSG:4326",
                    "address": address,
                    "refine": "true",
                    "simple": "false",
                    "format": "json",
                    "type": address_type,
                    "key": self.api_key,
                },
            )
            response = payload.get("response", {})
            if response.get("status") != "OK":
                continue
            result = response.get("result", {})
            point = result.get("point", {})
            refined = response.get("refined", {})
            structure = refined.get("structure", {})
            pnu = structure.get("level4LC") or None
            return GeocodeResult(
                normalized_address=refined.get("text") or address,
                longitude=float(point["x"]),
                latitude=float(point["y"]),
                coordinate_source=f"vworld:{address_type.lower()}",
                raw=payload,
                pnu=pnu,
            )
        return None

    def parcel(self, longitude: float, latitude: float, pnu: str | None = None) -> ParcelResult:
        params: dict[str, Any] = {
            "service": "data",
            "version": "2.0",
            "request": "getfeature",
            "format": "json",
            "size": 10,
            "page": 1,
            "geometry": "true",
            "attribute": "true",
            "crs": "EPSG:4326",
            "data": "LP_PA_CBND_BUBUN",
            "key": self.api_key,
            "domain": self.domain,
        }
        if pnu:
            params["attrfilter"] = f"pnu:=:{pnu}"
        else:
            params["geomfilter"] = f"POINT({longitude} {latitude})"
        payload = self._get("https://api.vworld.kr/req/data", params)
        response = payload.get("response", {})
        result = response.get("result") or {}
        collection = result.get("featureCollection") or {}
        features = collection.get("features") or []
        if not features:
            return ParcelResult(pnu=pnu, geometry=None, raw=payload)
        feature = features[0]
        props = feature.get("properties") or {}
        return ParcelResult(
            pnu=props.get("pnu") or pnu,
            geometry=feature.get("geometry"),
            raw=payload,
        )

