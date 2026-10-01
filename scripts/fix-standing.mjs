// scripts/fix-standing.mjs — one-off repair (2026-09-30).
// The public teaser bundle baked standing_detail strings from the city's
// opaque per-row violationratepercent, which can read 0% for a center
// flagged in most of its inspections (e.g. DC1021: 11 of 17 flagged, rate "0"
// -> "better than the NYC average"). This recomputes the three standing
// display fields from the center's own inspection counts, using the SAME
// logic as functions/api/_lib/data.js teaserOf (rate = round(100*flag/insp),
// cohort avg from the server bundle's SPROUT_META, rounded to 1 decimal).
// It does not invent data: insp, flag, cohort are already in each entry.
import { readFileSync, writeFileSync } from "node:fs";

const PUB = new URL("../assets/data/centers.json", import.meta.url);

function standingVerdict(ratePct, avgPct) {
  if (ratePct < 0.8 * avgPct) return "below_average";
  if (ratePct <= 1.2 * avgPct) return "near_average";
  return "above_average";
}
function standingDisplay(verdict) {
  if (verdict === "below_average") return "Better than the NYC average";
  if (verdict === "near_average") return "About the NYC average";
  return "Worse than the NYC average";
}
function standingDetailPhrase(verdict) {
  if (verdict === "below_average") return "better than the NYC average";
  if (verdict === "near_average") return "about the NYC average";
  return "worse than the NYC average";
}

const bundle = await import("../functions/api/_lib/sproutData.js");
const table = bundle.SPROUT_META.cohort_avg_violation_rate_pct || {};
const cohortAvg = (cohort) => {
  const v = parseFloat(table[cohort]);
  return isNaN(v) ? 30.9 : Math.round(v * 10) / 10;
};

const raw = readFileSync(PUB, "utf8");
const data = JSON.parse(raw);
let changed = 0;
for (const c of data.centers) {
  const rate = c.insp > 0 ? Math.round((100 * c.flag) / c.insp) : 0;
  const avg = cohortAvg(c.cohort);
  const verdict = standingVerdict(rate, avg);
  const display = standingDisplay(verdict);
  const detail =
    `Flagged in ${c.flag} of ${c.insp} inspections (${rate}% violation rate) vs ` +
    `${avg}% for ${c.cohort || "NYC"} — ${standingDetailPhrase(verdict)}.`;
  if (c.standing !== verdict || c.standing_display !== display || c.standing_detail !== detail) {
    c.standing = verdict;
    c.standing_display = display;
    c.standing_detail = detail;
    changed++;
  }
}
writeFileSync(PUB, JSON.stringify(data));
console.log(`updated ${changed} of ${data.centers.length} centers`);
// sanity spot-checks
for (const id of ["DC1021", "DC1000"]) {
  const c = data.centers.find((x) => x.id === id);
  console.log(id, "=>", c.standing_detail);
}
