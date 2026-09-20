// functions/api/_lib/data.js
// SproutScore server-side logic layer over the GENERATED real dataset
// (./sproutData.js — 3,014 NYC centers, 478 translated codes, built by
// ~/workspace/sproutscore/build/build-sproutscore-bundle.js).
//
// The 3.1MB bundle loads LAZILY (await import) so cold starts for unrelated
// routes never pay the parse cost. All public functions are async.
//
// Data rules (from ~/workspace/sproutscore/data/data-model.md):
// - severity tiers: critical / major / minor (city's max classification per code)
// - status shown verbatim: CORRECTED / OPEN / N/A. Never write "fixed" unless
//   status == CORRECTED; OPEN = "no correction on record by Apr 2023".
// - what_happened = translation plain_english, never paraphrased at render.
// - City inspection data ENDS April 2023 — every surface shows the caveat.

const DATA_CAVEAT =
  "City inspection data ends April 2023 — the city has published no newer inspection rows.";

let BUNDLE = null;
async function bundle() {
  if (!BUNDLE) BUNDLE = await import("./sproutData.js");
  return BUNDLE;
}

let CENTER_IDX = null;
async function centerIndex() {
  const b = await bundle();
  if (!CENTER_IDX) CENTER_IDX = new Map(b.SPROUT_CENTERS.map((c) => [c.id, c]));
  return CENTER_IDX;
}

// code tuple: [plain_english, severity, fixed_semantics, tour_question, family, source_text]
function codeEntry(codes, code) {
  return codes[code] || null;
}

const SEVERITY_RANK = { critical: 3, major: 2, minor: 1 };
const SEVERITY_DEDUCTION = { critical: 25, major: 10, minor: 3 };

function decodeViolation(v, codes) {
  // v: [code, date, inspection, city_category, status]
  const [code, date, inspection, city_category, status] = v;
  const t = codeEntry(codes, code);
  const severity = t ? t[1] : "minor";
  return {
    code,
    date,
    inspection,
    city_category,
    severity,
    what_happened: t ? t[0] : "Translation pending for this code.",
    status_plain: t ? t[2] : "",
    tour_question: t ? t[3] : "",
    family: t ? t[4] : code,
    city_text: t ? t[5] : "",
    status: status || "N/A",
  };
}

function statusLabel(status) {
  if (status === "CORRECTED") return "Corrected";
  if (status === "OPEN") return "Open — no correction on record";
  return "Not recorded";
}

function scoreViolations(decoded) {
  let score = 100;
  const lines = [];
  const bySeverity = { critical: 0, major: 0, minor: 0 };
  for (const d of decoded) {
    bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
    const base = SEVERITY_DEDUCTION[d.severity] ?? 3;
    const restored = d.status === "CORRECTED" ? Math.floor(base / 2) : 0;
    score -= base - restored;
    lines.push({
      code: d.code, severity: d.severity,
      deduction: base, restored, net: base - restored, status: d.status,
    });
  }
  score = Math.max(0, Math.min(100, score));
  const band = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 55 ? "D" : "F";
  return { score, band, lines, bySeverity };
}

function cohortAvg(meta, cohort) {
  const table = meta.cohort_avg_violation_rate_pct || {};
  if (cohort && table[cohort] != null) {
    const v = parseFloat(table[cohort]);
    if (!isNaN(v)) return v;
  }
  const g = parseFloat(meta.global_flagged_rate_pct);
  return isNaN(g) ? 30.9 : g;
}

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

async function getCenter(id) {
  const idx = await centerIndex();
  return idx.get(id) || null;
}

async function teaserOf(c) {
  const b = await bundle();
  const meta = b.SPROUT_META;
  const avg = cohortAvg(meta, c.cohort);
  const rate = parseFloat(c.rate) || 0;
  const verdict = standingVerdict(rate, avg);
  const decoded = (c.viol || [])
    .map((v) => decodeViolation(v, b.SPROUT_CODES))
    .sort(
      (a, z) =>
        (SEVERITY_RANK[z.severity] || 0) - (SEVERITY_RANK[a.severity] || 0) ||
        (a.date < z.date ? 1 : -1)
    );
  return {
    id: c.id,
    name: c.name,
    borough: c.boro,
    zip: c.zip,
    address: c.addr,
    phone: c.phone,
    age_range: c.age,
    capacity: c.cap,
    program_type: c.prog,
    child_care_type: c.cohort,
    inspections: c.insp,
    flagged: c.flag,
    clean: c.clean,
    standing: verdict,
    standing_display: standingDisplay(verdict),
    standing_detail:
      `Flagged in ${c.flag} of ${c.insp} inspections (${rate}% violation rate) vs ` +
      `${avg}% for ${c.cohort || "NYC"} — ${standingDisplay(verdict).toLowerCase()}.`,
    last_inspection: c.last,
    data_as_of: meta.data_as_of,
    data_caveat: DATA_CAVEAT,
    flagged_summary: decoded.slice(0, 8).map((d) => ({
      code: d.code, date: d.date, severity: d.severity,
      status: d.status, status_label: statusLabel(d.status),
    })),
  };
}

async function searchCenters(q) {
  const needle = String(q || "").trim().toLowerCase();
  if (needle.length < 2) return [];
  const b = await bundle();
  const out = [];
  for (const c of b.SPROUT_CENTERS) {
    const hay = (
      c.name + " " + c.addr + " " + c.zip + " " + c.boro + " " + (c.keys || []).join(" ")
    ).toLowerCase();
    if (hay.includes(needle)) {
      out.push(await teaserOf(c));
      if (out.length >= 20) break;
    }
  }
  return out;
}

function tourQuestionsFor(decoded) {
  // one question per distinct violation family; newest violation's wording wins
  const byFamily = new Map();
  for (const d of decoded) {
    if (!byFamily.has(d.family)) byFamily.set(d.family, d);
  }
  const qs = [...byFamily.values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((d) => d.tour_question)
    .filter(Boolean)
    .slice(0, 4);
  qs.push(
    "What is your staff-to-child ratio right now, in this room — and how do you cover breaks without breaking ratio?"
  );
  qs.push("May I see your two most recent full inspection reports — not just the summary?");
  return qs.slice(0, 6);
}

async function fullReport(c) {
  const b = await bundle();
  const meta = b.SPROUT_META;
  const decoded = (c.viol || [])
    .map((v) => decodeViolation(v, b.SPROUT_CODES))
    .sort(
      (a, z) =>
        (SEVERITY_RANK[z.severity] || 0) - (SEVERITY_RANK[a.severity] || 0) ||
        (a.date < z.date ? 1 : -1)
    );
  const scoring = scoreViolations(decoded);
  const avg = cohortAvg(meta, c.cohort);
  const rate = parseFloat(c.rate) || 0;
  const verdict = standingVerdict(rate, avg);

  // nearby: same ZIP, ranked by violation rate (lower = better)
  const nearby = b.SPROUT_CENTERS.filter((x) => x.zip === c.zip && x.id !== c.id)
    .map((x) => ({ id: x.id, name: x.name, rate: parseFloat(x.rate) || 0, flagged: x.flag }))
    .sort((a, z) => a.rate - z.rate);
  const rankPos = nearby.filter((x) => x.rate < rate).length + 1;
  const rankTotal = nearby.length + 1;
  const nearbyAvg = nearby.length
    ? nearby.reduce((s, x) => s + x.rate, 0) / nearby.length
    : null;

  const openCount = decoded.filter((d) => d.status === "OPEN").length;
  const correctedCount = decoded.filter((d) => d.status === "CORRECTED").length;

  return {
    center: await teaserOf(c),
    violations: decoded.map((d) => ({
      code: d.code,
      date: d.date,
      inspection: d.inspection,
      city_category: d.city_category,
      severity: d.severity,
      what_happened: d.what_happened,
      city_text: d.city_text,
      status: d.status,
      status_label: statusLabel(d.status),
      status_plain: d.status_plain,
      tour_question: d.tour_question,
    })),
    severity_summary: scoring.bySeverity,
    open_now: openCount,
    corrected: correctedCount,
    score: scoring.score,
    band: scoring.band,
    score_lines: scoring.lines,
    score_explained:
      "Start at 100. Each critical violation −25, major −10, minor −3. " +
      "A violation the city marked CORRECTED earns back half its deduction. " +
      "OPEN violations keep the full deduction — they are the ones to ask about on your tour.",
    comparison: {
      vs_nyc_avg: {
        center_violation_rate_pct: rate,
        nyc_avg_pct: avg,
        cohort: c.cohort,
        verdict,
        plain:
          `Flagged in ${c.flag} of ${c.insp} inspections (${rate}% violation rate) vs ` +
          `${avg}% for ${c.cohort || "NYC centers"} — ${standingDisplay(verdict).toLowerCase()}.`,
      },
      vs_nearby: {
        scope: c.zip ? `ZIP ${c.zip}` : "nearby",
        centers: rankTotal,
        rank: `${rankPos} of ${rankTotal}`,
        nearby_avg_rate_pct: nearbyAvg == null ? null : Math.round(nearbyAvg * 10) / 10,
        plain:
          nearby.length === 0
            ? "No other centers in our data share this ZIP."
            : rankPos <= Math.ceil(rankTotal / 2)
              ? `Ranked ${rankPos} of ${rankTotal} centers in ZIP ${c.zip} by violation rate — cleaner than most nearby.`
              : `Ranked ${rankPos} of ${rankTotal} centers in ZIP ${c.zip} by violation rate — more flagged than most nearby.`,
      },
    },
    tour_questions: tourQuestionsFor(decoded),
    data_as_of: meta.data_as_of,
    data_caveat: DATA_CAVEAT,
  };
}

// Sync helper kept for the flow test / demo paths that already hold a center.
async function scoreCenter(c) {
  const b = await bundle();
  const decoded = (c.viol || []).map((v) => decodeViolation(v, b.SPROUT_CODES));
  return scoreViolations(decoded);
}

export {
  DATA_CAVEAT,
  getCenter, searchCenters, teaserOf, fullReport, decodeViolation, scoreCenter,
  statusLabel, standingDisplay,
};
