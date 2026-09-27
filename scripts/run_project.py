from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import sqlite3
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]


class ProjectConfigError(ValueError):
    pass


def load_project_config(path: str | Path) -> dict[str, Any]:
    config_path = Path(path).resolve()
    data = json.loads(config_path.read_text(encoding="utf-8"))
    validate_project_config(data)
    data["_config_path"] = str(config_path)
    return data


def validate_project_config(config: dict[str, Any]) -> None:
    if config.get("version") != 1:
        raise ProjectConfigError("config.version must be 1")
    project = config.get("project") or {}
    for key in ("slug", "site_name", "site_address", "radius_m"):
        if project.get(key) in (None, ""):
            raise ProjectConfigError(f"project.{key} is required")
    slug = str(project["slug"])
    if not slug.replace("-", "").replace("_", "").isalnum():
        raise ProjectConfigError("project.slug must contain only letters, numbers, '-' or '_'")
    if float(project["radius_m"]) <= 0:
        raise ProjectConfigError("project.radius_m must be positive")
    schools = config.get("schools") or []
    facilities = config.get("facilities") or []
    if not schools:
        raise ProjectConfigError("at least one school is required")
    if not facilities:
        raise ProjectConfigError("at least one facility is required")
    names: set[str] = set()
    for group_name, items in (("schools", schools), ("facilities", facilities)):
        for index, item in enumerate(items):
            for key in ("name", "address", "source_url"):
                if item.get(key) in (None, ""):
                    raise ProjectConfigError(f"{group_name}[{index}].{key} is required")
            if item["name"] in names:
                raise ProjectConfigError(f"duplicate place name: {item['name']}")
            names.add(item["name"])
    for index, school in enumerate(schools):
        if school.get("school_type") not in {"초", "중", "고", "특수", "기타"}:
            raise ProjectConfigError(f"schools[{index}].school_type is invalid")
        if not isinstance(school.get("student_count"), int) or school["student_count"] < 0:
            raise ProjectConfigError(f"schools[{index}].student_count must be a non-negative integer")
    presentation = config.get("presentation") or {}
    if int(presentation.get("max_schools", 16)) > 16:
        raise ProjectConfigError("presentation.max_schools cannot exceed 16 for this template")
    if int(presentation.get("max_facilities", 6)) > 6:
        raise ProjectConfigError("presentation.max_facilities cannot exceed 6 for this template")


def research_rows(config: dict[str, Any]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for school in config["schools"]:
        rows.append({
            "name": school["name"],
            "category": "school",
            "address": school["address"],
            "source_url": school["source_url"],
        })
    for facility in config["facilities"]:
        rows.append({
            "name": facility["name"],
            "category": facility.get("category", "culture"),
            "address": facility["address"],
            "source_url": facility["source_url"],
        })
    return rows


def write_research_csv(config: dict[str, Any], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["name", "category", "address", "source_url"])
        writer.writeheader()
        writer.writerows(research_rows(config))


def _safe_asset_path(relative_path: str, asset_root: Path) -> Path:
    candidate = (ROOT / relative_path).resolve()
    root = asset_root.resolve()
    if candidate != root and root not in candidate.parents:
        raise ProjectConfigError(f"image.path must stay inside {root}: {relative_path}")
    return candidate


def download_assets(config: dict[str, Any], refresh: bool = False) -> list[Path]:
    slug = config["project"]["slug"]
    asset_root = ROOT / "assets" / "projects" / slug
    asset_root.mkdir(parents=True, exist_ok=True)
    downloaded: list[Path] = []
    for facility in config["facilities"]:
        image = facility.get("image") or {}
        relative_path = image.get("path")
        if not relative_path:
            continue
        destination = _safe_asset_path(relative_path, asset_root)
        if destination.exists() and destination.stat().st_size >= 1000 and not refresh:
            downloaded.append(destination)
            continue
        url = image.get("url")
        if not url:
            raise ProjectConfigError(f"missing image.url for {facility['name']}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        request = Request(url, headers={"User-Agent": "site-infra-map/1.0"})
        with urlopen(request, timeout=45) as response:
            payload = response.read()
        if len(payload) < 1000:
            raise RuntimeError(f"downloaded image is unexpectedly small: {facility['name']}")
        destination.write_bytes(payload)
        downloaded.append(destination)
    return downloaded


def _run(command: list[str], env: dict[str, str]) -> None:
    subprocess.run(command, cwd=ROOT, env=env, check=True)


def _next_output(path: Path) -> Path:
    if not path.exists():
        return path
    for number in range(2, 1000):
        candidate = path.with_name(f"{path.stem}_v{number}{path.suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError(f"could not allocate a new output name for {path}")


def run_pipeline(args: argparse.Namespace) -> dict[str, Any]:
    config = load_project_config(args.config)
    project = config["project"]
    run_id = args.run_id or datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = ROOT / "outputs" / project["slug"] / run_id
    run_dir.mkdir(parents=True, exist_ok=False)
    research_csv = run_dir / "research.csv"
    database = run_dir / "site_infra.sqlite3"
    write_research_csv(config, research_csv)

    if not args.skip_download:
        download_assets(config, refresh=args.refresh_assets)

    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT / "src")
    python = sys.executable
    cli = [python, "-m", "site_infra.cli"]
    _run(cli + ["init-db", "--db", str(database)], env)
    _run(cli + [
        "set-site", "--db", str(database), "--address", project["site_address"],
        "--radius-m", str(project["radius_m"]),
    ], env)
    _run(cli + ["import-csv", "--db", str(database), "--csv", str(research_csv)], env)

    with sqlite3.connect(database) as conn:
        site = conn.execute(
            "SELECT longitude, latitude, radius_m FROM sites ORDER BY updated_at DESC LIMIT 1"
        ).fetchone()
    if site is None:
        raise RuntimeError("site registration did not create a database record")
    _run(cli + [
        "geocode", "--db", str(database), "--site-lon", str(site[0]),
        "--site-lat", str(site[1]), "--radius-m", str(site[2]),
    ], env)

    with sqlite3.connect(database) as conn:
        unresolved = [
            {"name": row[0], "accuracy": row[1]}
            for row in conn.execute(
                "SELECT name, accuracy FROM facilities "
                "WHERE accuracy IN ('review_required', 'not_found') ORDER BY name"
            ).fetchall()
        ]

    exported_csv = run_dir / "facilities.csv"
    overview_qa = run_dir / "satellite_qa_overview.png"
    overview_base = run_dir / "satellite_base_overview.png"
    overview_meta = run_dir / "satellite_overview.json"
    detail_qa = run_dir / "satellite_qa_site_detail.png"
    map_config = config.get("map") or {}
    _run(cli + ["export-csv", "--db", str(database), "--output", str(exported_csv)], env)
    _run(cli + [
        "render-map", "--db", str(database), "--output", str(overview_qa),
        "--base-output", str(overview_base), "--metadata-output", str(overview_meta),
        "--zoom", str(map_config.get("overview_zoom", 16)),
    ], env)
    _run(cli + [
        "render-map", "--db", str(database), "--output", str(detail_qa),
        "--zoom", str(map_config.get("detail_zoom", 19)),
        "--view-radius-m", str(map_config.get("detail_view_radius_m", 180)),
    ], env)

    final_pptx: Path | None = None
    ppt_block_reason: str | None = None
    if unresolved and not args.allow_unresolved and not args.skip_ppt:
        ppt_block_reason = "PPT generation blocked by unresolved coordinates: " + ", ".join(
            f"{item['name']}({item['accuracy']})" for item in unresolved
        )
    elif not args.skip_ppt:
        required = ["PRESENTATIONS_SKILL_DIR", "RUNTIME_NODE_MODULES"]
        missing = [key for key in required if not env.get(key)]
        if missing:
            raise RuntimeError(
                "PPT generation requires Codex presentation runtime variables: " + ", ".join(missing)
            )
        runtime_node = env.get("RUNTIME_NODE") or shutil.which("node")
        if not runtime_node:
            raise RuntimeError("RUNTIME_NODE or a node executable on PATH is required")
        requested_name = (config.get("presentation") or {}).get(
            "output_name", f"{project['slug']}_site_analysis.pptx"
        )
        final_pptx = _next_output(ROOT / "deliverables" / requested_name)
        ppt_env = env | {
            "WORKSPACE_DIR": str(ROOT),
            "RUNTIME_PYTHON": env.get("RUNTIME_PYTHON", python),
            "SITE_ANALYSIS_CONFIG": str(Path(args.config).resolve()),
            "SITE_ANALYSIS_RUN_DIR": str(run_dir.resolve()),
            "FINAL_PPTX": str(final_pptx.resolve()),
        }
        _run([runtime_node, "scripts/build_site_analysis_pptx.mjs"], ppt_env)

    manifest = {
        "project": project["slug"],
        "run_id": run_id,
        "run_dir": str(run_dir),
        "database": str(database),
        "research_csv": str(research_csv),
        "facilities_csv": str(exported_csv),
        "overview_qa": str(overview_qa),
        "detail_qa": str(detail_qa),
        "overview_base": str(overview_base),
        "overview_metadata": str(overview_meta),
        "pptx": str(final_pptx) if final_pptx else None,
        "unresolved": unresolved,
        "ppt_block_reason": ppt_block_reason,
    }
    manifest_path = run_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    if ppt_block_reason:
        raise RuntimeError(f"{ppt_block_reason}. Review {manifest_path}")
    return manifest


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Run the reusable site-infrastructure pipeline")
    result.add_argument("--config", required=True, help="Project JSON configuration")
    result.add_argument("--run-id", help="Stable run directory name; defaults to a timestamp")
    result.add_argument("--validate-only", action="store_true")
    result.add_argument("--skip-download", action="store_true")
    result.add_argument("--refresh-assets", action="store_true")
    result.add_argument("--skip-ppt", action="store_true")
    result.add_argument(
        "--allow-unresolved", action="store_true",
        help="Allow PPT generation with review_required or not_found records",
    )
    return result


def main() -> None:
    args = parser().parse_args()
    if args.validate_only:
        config = load_project_config(args.config)
        print(json.dumps({
            "status": "valid",
            "project": config["project"]["slug"],
            "schools": len(config["schools"]),
            "facilities": len(config["facilities"]),
        }, ensure_ascii=False))
        return
    print(json.dumps(run_pipeline(args), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
