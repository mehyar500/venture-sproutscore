# DATA_SWAP.md — SproutScore data layer

The data sibling worker is producing the real dataset in
`~/workspace/sproutscore/data/` (centers.json, violation-translations.json,
data-model.md). Until it lands, everything builds against the STUB below.

## The swap contract (one module each side)

- **Client (browser):** `assets/data/centers.json` — teaser-level data ONLY.
  Never put full decoded violation explanations here; the client bundle is
  public and the decoded report is the paid product.
- **Server (Pages Functions):** `functions/api/_lib/data.js` — the full
  dataset + translation table. This is the ONE module to swap when the real
  data lands: keep the exported function signatures, replace the inline
  STUB with a load of the real JSON (or a D1/R2 fetch).

## Stub shape (the sibling should match these fields)

Teaser (public):
```json
{
  "id": "sunshine-corner-daycare",
  "name": "Sunshine Corner Daycare",
  "borough": "Brooklyn", "zip": "11215",
  "address": "123 5th Ave, Brooklyn, NY 11215",
  "license_type": "Group Family Day Care",
  "inspections": 14, "flagged": 3,
  "standing": "below",            // above | average | below  (vs NYC average)
  "standing_detail": "3 flagged of 14 inspections — NYC average is 2.1 flagged per center",
  "last_inspection": "2026-06-18",
  "data_as_of": "2026-09-15",
  "flagged_summary": [
    {"code": "47.39(c)", "date": "2026-06-18", "severity": "critical", "status": "corrected"},
    {"code": "47.59(b)", "date": "2025-11-02", "severity": "serious", "status": "corrected"},
    {"code": "47.45",    "date": "2024-08-21", "severity": "minor",    "status": "corrected"}
  ]
}
```

Report (server-side only):
```json
{
  "violations": [
    {"code": "47.39(c)", "date": "2026-06-18",
     "severity": "critical", "status": "corrected",
     "what_happened": "…", "why_it_matters": "…", "fixed": "…"}
  ],
  "severity_summary": {"critical": 1, "serious": 1, "minor": 1},
  "score": 72,
  "score_explained": "…",
  "comparison": {"center_flagged": 3, "nyc_avg_flagged": 2.1, "percentile": 38},
  "nearby": [{"name": "…", "score": 88, "flagged": 0}],
  "tour_questions": ["…", "…", "…"]
}
```

## Scoring formula (stub, illustrative — sibling owns the final model)

Start at 100. critical −25, serious −10, minor −3. A violation marked
`corrected` restores half its deduction. Clamp 0–100. Band: 90+ A · 80+ B ·
70+ C · 55+ D · below F. The report page shows the math line-by-line so the
score is never a black box.

## Sync script

`scripts/sync-data.sh` regenerates `assets/data/centers.json` (teaser split)
and `functions/api/_lib/data.js` (full split) from the sibling's
`~/workspace/sproutscore/data/` once it lands. Until then it exits with a
clear "no source data yet" message — never silently shipping an empty set.
