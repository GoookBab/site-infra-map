from __future__ import annotations

import argparse
import csv
import os
from pathlib import Path

from .db import connect, upsert_research, upsert_site
from .geo import point_in_geometry
from .models import Accuracy, ResearchFacility
from .map_qa import render_satellite_qa
from .pipeline import geocode_pending
from .vworld import VWorldClient


def _load_env_file(path: str | Path = ".env") -> None:
    """외부 패키지 없이 로컬 .env를 읽되 기존 환경변수는 덮어쓰지 않는다."""
    env_path = Path(path)
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"").strip("'")
        if key:
            os.environ.setdefault(key, value)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="사이트 인프라 좌표 DB")
    commands = parser.add_subparsers(dest="command", required=True)

    init = commands.add_parser("init-db")
    init.add_argument("--db", required=True)

    imp = commands.add_parser("import-csv")
    imp.add_argument("--db", required=True)
    imp.add_argument("--csv", required=True)

    geo = commands.add_parser("geocode")
    geo.add_argument("--db", required=True)
    geo.add_argument("--site-lat", required=True, type=float)
    geo.add_argument("--site-lon", required=True, type=float)
    geo.add_argument("--radius-m", required=True, type=float)

    site = commands.add_parser("set-site")
    site.add_argument("--db", required=True)
    site.add_argument("--address", required=True)
    site.add_argument("--radius-m", default=2000, type=float)

    exp = commands.add_parser("export-csv")
    exp.add_argument("--db", required=True)
    exp.add_argument("--output", required=True)

    render = commands.add_parser("render-map")
    render.add_argument("--db", required=True)
    render.add_argument("--output", required=True)
    render.add_argument("--zoom", default=16, type=int)
    render.add_argument("--view-radius-m", type=float)
    return parser


def main() -> None:
    _load_env_file()
    args = _parser().parse_args()
    conn = connect(args.db)
    if args.command == "init-db":
        print(f"initialized: {args.db}")
    elif args.command == "import-csv":
        count = 0
        with open(args.csv, encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                upsert_research(
                    conn,
                    ResearchFacility(
                        name=row["name"],
                        category=row["category"],
                        address=row["address"],
                        source_url=row.get("source_url", ""),
                    ),
                )
                count += 1
        print(f"imported: {count}")
    elif args.command in {"geocode", "set-site"}:
        key = os.getenv("VWORLD_API_KEY")
        if not key:
            raise SystemExit("VWORLD_API_KEY 환경변수가 필요합니다.")
        client = VWorldClient(key, os.getenv("VWORLD_DOMAIN", "http://localhost"))
        if args.command == "geocode":
            print(geocode_pending(conn, client, args.site_lon, args.site_lat, args.radius_m))
        else:
            result = client.geocode(args.address)
            if result is None:
                raise SystemExit("대상지 주소를 찾지 못했습니다.")
            parcel = client.parcel(result.longitude, result.latitude, result.pnu)
            if parcel.pnu and not result.pnu:
                result.pnu = parcel.pnu
            accuracy = (
                Accuracy.PARCEL_VERIFIED
                if point_in_geometry(result.longitude, result.latitude, parcel.geometry)
                else Accuracy.ADDRESS_MATCHED if parcel.geometry is None
                else Accuracy.REVIEW_REQUIRED
            )
            site_id = upsert_site(
                conn, args.address, result, accuracy, args.radius_m, parcel.geometry
            )
            print(
                f"site_id={site_id} address={result.normalized_address} "
                f"lon={result.longitude:.8f} lat={result.latitude:.8f} "
                f"pnu={result.pnu or ''} accuracy={accuracy.value} radius_m={args.radius_m:g}"
            )
    elif args.command == "export-csv":
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        rows = conn.execute("SELECT * FROM facilities ORDER BY category, distance_m, name").fetchall()
        with output.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(rows[0].keys() if rows else [])
            writer.writerows(tuple(row) for row in rows)
        print(f"exported: {len(rows)}")
    elif args.command == "render-map":
        key = os.getenv("VWORLD_API_KEY")
        if not key:
            raise SystemExit("VWORLD_API_KEY 환경변수가 필요합니다.")
        path = render_satellite_qa(
            conn, key, args.output, zoom=args.zoom, view_radius_m=args.view_radius_m
        )
        print(f"rendered: {path}")


if __name__ == "__main__":
    main()
