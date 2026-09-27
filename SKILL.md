---
name: site-infra-map
description: Turn a Korean architectural site address and sourced school or facility records into a VWorld parcel-verified database, satellite QA maps, and an editable PowerPoint site-analysis deck. Use for repeatable nearby-infrastructure research and presentation workflows; do not use it as a substitute for sourcing facility facts or image rights.
---

# Site Infrastructure Map

Turn a Korean site address and researched facility records into an auditable spatial database, satellite QA maps, and a two-slide editable PowerPoint analysis. Keep research, coordinate verification, and presentation generation as separate traceable stages.

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

## Project configuration

Create a project JSON rather than editing scripts. Read [references/project-config.md](references/project-config.md) when creating or changing a project configuration. Start from `examples/munjeong-project.json`.

The configuration is the evidence contract. Every school and facility needs a complete address and source URL. Student counts need an integer and cited source. Facility photographs need a local path plus the image-source page. Optional coordinates are fallbacks only; prefer the pipeline's VWorld result.

## Workflow

1. Research names, complete addresses, student counts, official source URLs, and image sources. Do not invent missing attributes.
2. Validate the project JSON before network calls.
3. Run the project pipeline. It creates a new timestamped run directory, so earlier databases and maps remain intact.
4. Review `facilities.csv` and the overview and detail QA images. Resolve `review_required` and `not_found` records before using the deck as final evidence.
5. Generate the PowerPoint from the clean satellite base and metadata. Keep its table, radius, points, labels, and text editable. Keep the satellite base and photographs as images.

```powershell
python scripts/run_project.py --config examples/munjeong-project.json --validate-only
python scripts/run_project.py --config examples/munjeong-project.json
```

Before the full command, set the VWorld variables. In Codex, also load the presentation runtime and set `RUNTIME_NODE`, `RUNTIME_NODE_MODULES`, `RUNTIME_PYTHON`, and `PRESENTATIONS_SKILL_DIR`. If that runtime is unavailable, run with `--skip-ppt` and retain all spatial outputs.

The low-level CSV importer accepts `name`, `category`, and `address`, but the reusable project configuration also requires `source_url` so every plotted record remains auditable.

## Accuracy contract

- `parcel_verified`: the VWorld address point lies inside the returned cadastral parcel.
- `address_matched`: an address point exists but parcel verification was unavailable.
- `review_required`: the returned point and parcel conflict or the response is incomplete.
- `not_found`: geocoding failed.

Do not describe `parcel_verified` as an exact entrance, building centroid, or facility boundary. It proves address-to-parcel consistency and deterministic satellite placement. Campuses, parks, hospitals, stations, and multi-building complexes need an explicit anchor policy such as main entrance, representative building, parcel union, or platform/exit point. Satellite acquisition dates and cadastral update dates can differ, so retain the high-zoom visual QA step.

## Deliverables and stopping conditions

Return the run manifest, SQLite database, exported CSV, overview QA image, detail QA image, clean satellite base, metadata JSON, and editable PPTX when enabled. Keep source URLs and raw VWorld responses in the database and slide speaker notes.

Stop before claiming a final presentation when any plotted record is `not_found` or `review_required`, a required photograph is missing, or the slide render has overlap or clipping. Report the unresolved record instead of silently dropping it.

For code changes, run:

```powershell
$env:PYTHONPATH="src"
python -m unittest discover -s tests -v
```
