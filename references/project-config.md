# Project configuration

Use a UTF-8 JSON file with `version: 1`. Paths are resolved from the skill repository root.

## Required project fields

```json
{
  "version": 1,
  "project": {
    "slug": "project-id",
    "site_name": "표시용 대상지명",
    "site_address": "도로명 또는 지번주소",
    "radius_m": 2000
  },
  "schools": [],
  "facilities": []
}
```

`slug` uses letters, numbers, `-`, or `_`. Each run writes to a new timestamped directory under `outputs/<slug>/` so an earlier database or map is not overwritten.

## Schools

Every school requires:

- `name`, `address`, `source_url`
- `short_name` for map labels
- `school_type`: `초`, `중`, `고`, `특수`, or `기타`
- `student_count`: non-negative integer from the cited source

Optional `longitude` and `latitude` are fallbacks for presentation placement. The pipeline still geocodes the address and prefers the verified VWorld result.

## Facilities

Every facility requires `name`, `address`, `source_url`, and a category. The presentation selects at most six facilities.

```json
{
  "name": "시설명",
  "short_name": "지도 라벨",
  "category": "culture",
  "address": "전체 주소",
  "source_url": "https://official.example/facility",
  "image": {
    "path": "assets/projects/project-id/facility.jpg",
    "url": "https://example/facility.jpg",
    "source_url": "https://example/photo-page"
  }
}
```

Keep downloaded images under `assets/projects/<slug>/`. `image.source_url` is written to slide speaker notes.

## Presentation options

`presentation` can override titles, headings, output name, font family, and display limits. The current A4 landscape template supports up to 16 schools and six facility photographs.

Use `narratives.school` and `narratives.facility` arrays only when project-specific interpretation has been reviewed. Otherwise the builder generates factual summaries from the supplied counts and locations.

## Commands

Validate without network calls or file generation:

```powershell
python scripts/run_project.py --config examples/munjeong-project.json --validate-only
```

Run data, geocoding, maps, assets, and PowerPoint:

```powershell
python scripts/run_project.py --config examples/munjeong-project.json
```

Use `--skip-ppt` when the Codex presentation runtime is unavailable. Use `--skip-download` when every configured image already exists locally.
