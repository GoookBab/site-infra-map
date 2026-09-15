---
name: site-infra-map
description: Build a reusable Korean architectural site-infrastructure database from researched facility addresses, verify coordinates against VWorld parcel geometry, filter by radius, and render exact QA overlays on VWorld satellite imagery. Use for site analysis, nearby-infrastructure mapping, address geocoding, parcel verification, or preparing map data for architectural presentations in South Korea.
---

# Site Infrastructure Map

Turn a Korean site address and researched facility addresses into an auditable spatial database and satellite QA maps. Treat visual styling and presentation templates as a later step; first make the coordinates, parcels, sources, and radius decisions reproducible.

## Required setup

Use the directory containing this `SKILL.md` as the skill root. Run commands from that directory or invoke `scripts/site_infra.py` by its absolute path.

Python 3.10+ is required. Install the package in an isolated environment when Pillow is unavailable:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -e .
```

Create `.env` from `.env.example`. Never commit `.env`, print its value, embed the key in URLs shown to the user, or save it in SQLite/CSV/output images.

## VWorld API key

1. Sign up or sign in at [VWorld](https://www.vworld.kr/).
2. Open **오픈API → 인증키 발급** or go to the [authentication-key page](https://www.vworld.kr/dev/v4dv_apikey_s002.do).
3. Create a development key and register the actual calling domain. For local CLI testing, register `http://localhost` if VWorld accepts it for the selected service.
4. Copy `.env.example` to `.env` and set:

```dotenv
VWORLD_API_KEY=your_key_here
VWORLD_DOMAIN=http://localhost
```

If VWorld reports a domain/authentication error, make the registered domain and `VWORLD_DOMAIN` identical, including scheme and port when applicable. Manage or rotate the key in VWorld rather than placing it in source code.

## Workflow

1. Confirm the target address, radius, and facility categories. If radius is omitted, state the working assumption before using it.
2. Register the site. This geocodes the road address, resolves its PNU and parcel polygon, and stores a verification status.
3. Research facility names and complete street/parcel addresses. Prefer official institution, municipal, education-office, or public-data pages. Store the source URL with every record.
4. Import the research CSV and geocode it against the registered site.
5. Accept `parcel_verified` records for automatic plotting. Inspect `address_matched`, `review_required`, and `not_found` records before presentation use.
6. Export the normalized table and render an overview plus a high-zoom site detail. When an editable presentation is required, also export the clean satellite base and map metadata.
7. Build the PowerPoint only after coordinate QA. Keep the satellite image as a raster base and make radius rings, points, labels, explanatory text, and data tables native editable slide objects.

```powershell
python scripts/site_infra.py init-db --db data/site_infra.sqlite3
python scripts/site_infra.py set-site --db data/site_infra.sqlite3 --address "서울특별시 송파구 법원로8길 8" --radius-m 2000
python scripts/site_infra.py import-csv --db data/site_infra.sqlite3 --csv data/research_sample.csv
python scripts/site_infra.py geocode --db data/site_infra.sqlite3 --site-lat 37.48400064 --site-lon 127.12191138 --radius-m 2000
python scripts/site_infra.py export-csv --db data/site_infra.sqlite3 --output outputs/facilities.csv
python scripts/site_infra.py render-map --db data/site_infra.sqlite3 --output outputs/satellite_qa_overview.png --base-output outputs/satellite_base_overview.png --metadata-output outputs/satellite_overview.json --zoom 16
python scripts/site_infra.py render-map --db data/site_infra.sqlite3 --output outputs/satellite_qa_site_detail.png --zoom 19 --view-radius-m 180
```

The research CSV requires `name`, `category`, and `address`; `source_url` is optional but should normally be populated.

## Accuracy contract

- `parcel_verified`: the VWorld address point lies inside the returned cadastral parcel.
- `address_matched`: an address point exists but parcel verification was unavailable.
- `review_required`: the returned point and parcel conflict or the response is incomplete.
- `not_found`: geocoding failed.

Do not describe `parcel_verified` as an exact entrance, building centroid, or facility boundary. It proves address-to-parcel consistency and deterministic satellite placement. Campuses, parks, hospitals, stations, and multi-building complexes need an explicit anchor policy such as main entrance, representative building, parcel union, or platform/exit point. Satellite acquisition dates and cadastral update dates can differ, so retain the high-zoom visual QA step.

## Deliverables

Return the SQLite database, exported CSV, overview QA image, detail QA image, counts by verification status, excluded out-of-radius records, and any unresolved records requiring review. When requested, also return an editable PPTX built from the clean satellite base and metadata JSON. Keep source URLs and raw VWorld responses in the database and slide speaker notes for auditability.

For code changes, run:

```powershell
$env:PYTHONPATH="src"
python -m unittest discover -s tests -v
```
