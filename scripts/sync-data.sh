#!/bin/bash
# scripts/sync-data.sh — regenerate SproutScore frontend data from the sibling
# data worker's output at ~/workspace/sproutscore/data/.
#   source:  ~/workspace/sproutscore/data/{centers.json,violation-translations.json}
#   targets: functions/api/_lib/sproutData.js  (full dataset, server-only,
#              built by the sibling's build-sproutscore-bundle.js — fails loudly
#              on any violation code missing a complete translation)
#            assets/data/centers.json          (teaser-level public bundle:
#              codes/dates/severity/status only — never plain-English decodes)
set -euo pipefail
SRC="$HOME/workspace/sproutscore/data"
BLD="$HOME/workspace/sproutscore/build/build-sproutscore-bundle.js"
DST="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "$SRC/centers.json" || ! -f "$SRC/violation-translations.json" ]]; then
  echo "NO SOURCE DATA: expected $SRC/centers.json and $SRC/violation-translations.json" >&2
  exit 2
fi
if [[ ! -f "$BLD" ]]; then
  echo "NO BUILD SCRIPT: expected $BLD" >&2
  exit 2
fi

# 1. server dataset (full, deterministic)
node "$BLD" "$DST/functions/api/_lib/sproutData.js"

# 2. public teaser bundle (slimmed)
node - "$SRC" "$DST" <<'EOF'
const fs = require("fs");
const src = process.argv[2], dst = process.argv[3];
const raw = JSON.parse(fs.readFileSync(src + "/centers.json", "utf8"));
const trans = JSON.parse(fs.readFileSync(src + "/violation-translations.json", "utf8"));
const codes = trans.codes;
const cohortTable = raw.meta.cohort_avg_violation_rate_pct || {};
function cohortAvg(cohort) {
  const v = parseFloat(cohortTable[cohort]);
  if (!isNaN(v)) return v;
  const g = parseFloat(raw.meta.global_flagged_rate_pct);
  return isNaN(g) ? 30.9 : g;
}
function standingFor(c) {
  const avg = cohortAvg(c.child_care_type);
  const rate = parseFloat(c.city_violation_rate_pct) || 0;
  const verdict = rate < 0.8 * avg ? "better" : rate <= 1.2 * avg ? "average" : "worse";
  const display = verdict === "better" ? "Better than the NYC average"
    : verdict === "average" ? "About the NYC average" : "Worse than the NYC average";
  const verdictWord = verdict === "better" ? "better than" : verdict === "average" ? "about" : "worse than";
  const detail = `Flagged in ${c.flagged} of ${c.inspections} inspections ` +
    `(${rate}% violation rate) vs ${avg}% for ${c.child_care_type || "NYC centers"} — ${verdictWord} the NYC average.`;
  return { verdict, display, detail };
}
const teasers = raw.centers.map((c) => {
  const st = standingFor(c);
  return {
    id: c.center_id, name: c.name, addr: c.address, boro: c.borough, zip: c.zipcode,
    insp: c.inspections, flag: c.flagged, last: c.last_inspection,
    rate: c.city_violation_rate_pct, cohort: c.child_care_type,
    standing: st.verdict, standing_display: st.display, standing_detail: st.detail,
    // teaser-level only: code + date + severity + status. No plain-English decodes.
    flagged: (c.violations || []).map((v) => [
      v.code, v.date, (codes[v.code] || {}).severity || "minor", v.status || "N/A",
    ]),
  };
});
const out = {
  meta: {
    centers_count: teasers.length,
    data_as_of: raw.meta.data_as_of,
    data_caveat: "City inspection data ends April 2023 — the city has published no newer inspection rows.",
    source: raw.meta.source,
  },
  centers: teasers,
};
const p = dst + "/assets/data/centers.json";
fs.writeFileSync(p, JSON.stringify(out));
console.log("wrote", p, "bytes:", Buffer.byteLength(JSON.stringify(out)),
            "| centers:", teasers.length);
EOF
