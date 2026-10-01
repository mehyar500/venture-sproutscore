# SproutScore — Design Critique (two screenshot passes, 390×844)

Method: Playwright (Chrome for Testing 153) against the local harness that runs
the REAL Pages Functions + mock D1 (`scripts/test-server.mjs`). All 13 shots in
`screenshots/pass1/` and `screenshots/pass2/` (pass 2 re-shot after fixes).
Zero horizontal scroll verified programmatically on all 8 pages (scrollW=390, 0 offenders).

## Five-second test (landing, pass 1)

1. What is this? — "NYC DAYCARE INSPECTION DECODER / Is your daycare actually safe?" ✅
2. Who is it for? — NYC parents choosing a daycare ✅
3. What's the free action? — "Search free" search box, right in the hero ✅
4. What does paid add? — NOT in the first viewport; the tier grid ("Start free.
   Upgrade when it matters." → $19 decoded report) answers it one scroll down.
   Verdict: pass, but the $19 could be named in the hero lede later.

## Buyer monologue (landing → search → teaser → paywall)

> "Is this real inspection data?" — Sample-data banner says so upfront, on every
> page. Honest. "What do I get free?" — inspections count, flagged count,
> standing vs NYC average, raw flagged codes. "Why would I pay $19?" — the
> before/after panel on center.html answers it exactly: raw code vs. plain-English
> translation. "What happens after I pay?" — success page polls payment status,
> then links the token-gated report. The flow reads end-to-end.

## Pass 1 findings (numbered)

- **FIX-1 — hero search input clipped.** The input+button flex row squeezed the
  input so the placeholder read "Daycare name, addres". Fix: stack them
  full-width under 600px. (First attempt targeted a nonexistent `.searchbox`
  class — the real class is `.search-box`; corrected and re-verified.)
- **FIX-2 — sticky-header stitch artifact in fullPage screenshots.** The
  `position:sticky` header repeated mid-page in fullPage captures (NOT a page
  bug — viewport shots were correct). Fix in the shoot script: pin header static
  for fullPage captures only.
- **FIX-3 — success page spun forever when unreachable.** If the payment-status
  endpoint never answers, the spinner ran indefinitely. Fix: stop after ~12
  attempts (~60s), hide the spinner, and point the buyer at the manual token box.
- **FIX-4 — dead no-op line in center.html:** `document.getElementById("paywall").scrollIntoView;`
  (missing call). Replaced with a real smooth scroll.

## Pass 2 verdict (after fixes)

- Hero: input full-width, placeholder fully visible, big thumb-friendly
  "Search free" button. ✅
- Search results: header renders once, no overlap, result card clean, flagged
  count in red, sample-data banner honest. ✅
- Teaser: stat tiles, standing card, flagged list with severity tags, email
  capture before the paywall, before/after panel, $19 + $39 cards, disclaimers,
  footer with Privacy/Terms/Unsubscribe everywhere. ✅
- Report (demo): sample banner unmissable, score ring 80/Grade B, transparent
  scoring math, severity summary, violations decoded, comparison, tour questions.
  Print view (PDF): light background, dark text, score + severity tiles print
  cleanly, sections avoid page breaks mid-card. ✅
- Success: stuck-at-spinner failure mode eliminated; token paste box available.
  (Live payment-status polling could not be exercised locally — mehyar.us is
  unreachable from this sandbox; verify on staging with a real checkout.)
- Mobile audit: all CTAs ≥48px, email/checkout inputs full-width, no page needs
  horizontal scroll, Privacy + Terms linked in every footer and every email
  capture context. ✅

**Verdict: SHIP the frontend as built.** Remaining risk is all in integration,
not design: real checkout redirect, real payment-status polling, real sibling
dataset swap, real D1.

## Pass 3 (2026-09-20) — real dataset integration

Screenshots: `screenshots/pass3/` (13 files, same set as passes 1–2).

What changed: stub dataset replaced with the real NYC DOHMH bundle —
3,014 centers, 478 translated violation codes, data as of Apr 24, 2023.
Server: `functions/api/_lib/sproutData.js` (generated, lazy-imported) +
rewritten `functions/api/_lib/data.js` (async logic layer: severity
critical/major/minor, cohort standing, OPEN/CORRECTED semantics, data caveat).
Teaser bundle `assets/data/centers.json` regenerated (teaser-level only —
codes/dates/severity/status, no plain-English decodes).

Issues found and fixed in this pass:
- **FIX-5 — report.html read `c.addr`/`c.boro` from the API** (server returns
  `address`/`borough`): demo report header showed "undefined, undefined".
  Fixed.
- **FIX-6 — fake 2026 date in index hero.** The before/after panel showed a
  fabricated "DATE CITED: 2026-06-18". Rebuilt from a real record:
  violation 43.09(b), cited 2022-08-16, CORRECTED.
- **FIX-7 — stale "sample data while we build" notices** on search.html and
  center.html footers. Replaced with the real-dataset statement + data caveat.
- **FIX-8 — "fixed" language** ("whether it was fixed", "fixed-or-not") in
  index/center marketing copy. Reworded to correction semantics per city
  record rules.
- **FIX-9 — empty inspection names** rendered as "Inspector's citation (,
  Dec 6, 2022)". Now omitted when blank. Also relabeled "Why it matters"
  (which showed the correction-record text) to "Correction record".
- **FIX-10 — demo banner** claimed "sample data"; the demo now decodes a
  real center (DC1021, 22 violations). Banner reworded.

Verified in pass 3:
- Search "sunshine": 33 real centers, real addresses/boroughs/ZIPs, clean-record
  badges where applicable. ✅
- Teaser (DC1000, BILLY MARTIN CHILD DEVELOPMENT CENTER): 6 inspections,
  2 flagged, cohort standing "Worse than the NYC average" with the Apr 2023
  caveat inline, 8 raw flags with severity tags. ✅
- Paid report (demo, NUESTROS NINOS DAY CAR 1): real address, 17 inspections,
  score 6 / Grade F, transparent math (critical −25 / major −10 / minor −3,
  CORRECTED restores half), 22 decoded violations, cohort + ZIP comparison,
  tour questions, data caveat prominent. ✅
- Mobile audit re-run: all 8 pages scrollWidth=390, zero overflow offenders. ✅
- Flow test: 14/14 on real data. ✅

**Verdict: SHIP after real-data integration.** Frontend now renders only real
records; no fabricated dates, no "sample data" disclaimers remain. Remaining
risks unchanged: live payment-status polling (mehyar.us unreachable from
sandbox), real D1 tables in production, `sproutsScore` vs `sproutscore` brand
confirmation, and Mayor's human review of the 478 translation rows
(still PENDING_MAYOR_REVIEW) before launch.

## Pass 4 (2026-09-20) — blur-gated funnel + landing rewrite + exact caveat copy

Data verdict arrived: per-violation text rows approved — the full "every
violation decoded" promise stands (no longer swappable). Mayor's finalized
ladder is now: search → teaser with counts BLURRED → email capture ("Enter
your email to reveal your free result") → revealed free result → $19 upgrade.

What changed:
- **center.html restructured into two states.** Pre-capture: name + address +
  masked count tiles (◆ glyphs — real numbers are NOT in the teaser DOM, aria
  text, or copied text) + the email capture card + paywall (before/after panel
  masked: "VIOLATION CODE — masked until you reveal your free result"). Post
  successful /api/subscribe: counts, standing vs cohort NYC average, data-as-of,
  raw flags, 3 tour questions revealed; state persists per-center via
  localStorage (`ss_reveal_<id>`), restored on reload without re-capture.
  Failed capture keeps everything masked with an error.
- **index.html hero rewritten** to Mayor's copy: "$30k/year contract based on
  vibes and a tour" H1; exact sub "Every NYC daycare violation the city
  published, decoded in plain English." / "Inspection history 2020–2023 ·
  NYC Dept. of Health data · $19 full report"; 3,014 centers · 100k+ kids proof
  line; how-it-works now mirrors the blur → capture → reveal ladder.
- **Exact data-model.md copy everywhere:** stale-data banner verbatim on
  landing, teaser (pre- and post-reveal), and paid report; center-not-found
  copy on search + center not-found states; low-data caveat (< 3 inspections)
  in the revealed result; source-down copy on search fetch failure.
- **Nearby comparison widened:** same ZIP, but borough scope when < 5 centers
  share the ZIP (ties share rank) — per data-model.md.
- **Search results no longer leak counts** ("Inspection record on file — tap to
  check") so the teaser blur is the first numbers the parent sees.
- Banned words audit: no "recent" / "up-to-date" / "live data" anywhere.

Verified in pass 4:
- Funnel test (new scripts/funnel-test.mjs, real handlers + mock D1 via
  test-server.mjs, Playwright 390×844): **15/15** — masked pre-capture (no
  readable digits in hook, reveal targets still "—", paywall before-panel
  masked, banner present), successful capture → reveal (6 insp / 2 flagged for
  DC1000, localStorage persisted), reload restores revealed state, failed
  capture (500) stays masked, buy-without-email still gated, search rows show
  no counts, zero horizontal overflow on all 6 audited URLs.
- Backend flow test: **17/17** (was 14) — added small-ZIP borough widening
  (DC11176 ZIP 11419 → "Queens (borough)", 362 of 654), large-ZIP keeps ZIP
  scope, OPEN violation status_plain carries the "no correction recorded"
  wording.
- Screenshots pass4 (13 shots + print PDF): masked teaser, revealed result,
  new hero, decoded report, print/PDF all reviewed at 390px. 08-report-full
  needed a DSF-1 re-capture (protocol size limit at DSF-2 — capture artifact,
  not a page bug).
- Inline JS + module syntax checks pass; Privacy/Terms linked on all 8 pages.

**Verdict: SHIP the funnel.** New risks to carry: translation table is still
PENDING_MAYOR_REVIEW — Mayor must spot-check severity tiers + tour questions
for top families (47.33, 47.41, 47.37, 47.25, 47.19) before launch; live
payment-status polling still unexercised from sandbox; production D1 tables
still unconfirmed.

## Pass 5 — 2026-09-30: product-excellence hardening (workstream 1)

Thirteen fixes applied, then a 13-shot critique pass at 390×844
(`screenshots/pass5/`), zero horizontal overflow verified on all 8 pages.

**Bugs fixed:**
- **3-pack price truth: $39 → $29.** D1 (`mehyar_leads_prod`, read live
  2026-09-30) charges `sproutscore-3pack` = 2900¢. The frontend advertised $39
  while the webhook would charge $29. Fixed everywhere: `app.js`
  (`PRICE_3PACK = 29`), `index.html` price card, `center.html` 3-pack card +
  button, `terms.html`, `drip/04-last-call.{txt,html}`, `schema.sql` seed
  (3900→2900), `INTEGRATION.md` (table + "$19/$39" line), `README.md`.
- **Severity styling gap (major was unstyled).** Data tiers are
  critical/major/minor, but CSS only styled `.sev-serious` (a pre-integration
  name, dead) — major flags got a minor-colored border with an unstyled tag.
  Added `.sev-major` rules to the flags list and the report violation cards;
  removed the dead `.sev-serious` selectors. Verified visually (gold MAJOR
  tags + gold left borders) in pass-5 screenshots.
- **Score-ring `var()` in SVG presentation attribute.** `report.html` set
  `stroke="var(--line)"` and `arc.setAttribute("stroke", bandColor(...))` —
  invalid; browsers fall back to black. Moved both to `style.stroke` and set
  the ring's `aria-label` dynamically ("Safety score 6 out of 100, Grade F").
  Verified programmatically: computed arc stroke = rgb(251, 113, 133) (crit).
- **Report "as of" date** now comes from `r.data_as_of` (was hardcoded
  "Apr 24, 2023").
- **Tour questions** on center.html now always pad to exactly 3 (header
  promises "Your 3 free tour questions").
- **Offline state** on center.html: fetch failure now shows a "We couldn't
  reach the records" section with a retry button instead of the misleading
  "not found" section; report.html's denied state gained a retry button too.
- **Accessibility:** token input on success.html got an `aria-label`;
  `:focus-visible` accent outlines on links/buttons/summary/inputs.
- **Print CSS** hardened for the report: `.vcode`, `.lede`, `.hero-proof`,
  `.flag-meta`, `.rmeta`, `.disclaimer`, `.standing .data-asof` all print
  dark-on-white; `.share-card` and `.sample-banner` lose their dark/gold
  treatments; status pills get print-safe colors.
- **Honest funnel copy:** index FAQ "Is the free search really free?" now
  matches the blur-gated funnel (counts revealed after the free email reveal);
  free-tier list item reads "Free email reveal: inspection + flagged counts".
- **SW data freshness:** `/assets/data/*` is now network-first (was
  cache-first, so a future data swap would never reach returning visitors);
  cache bumped to `sproutscore-v2`.
- **package.json `"type": "module"`** — kills the MODULE_TYPELESS_PACKAGE_JSON
  reparse warning in flow-test/funnel-test/shoot.
- **Dead CSS removed:** `.rflags .ok`, `.rflags .bad` (unused — search rows
  never show counts), duplicate trailing `.centered` definition.
- **Docs:** README (stale "currently empty" data dir, wrong dataset filename,
  "14 checks" → 17, $39 → $29), INTEGRATION.md ($39 → $29), DATA_SWAP.md
  marked SUPERSEDED (post-integration reference only).

**Tests:** flow-test **17/17**, funnel-test **15/15**. New
`scripts/audit-pages.mjs`: zero horizontal overflow on 9 URLs
(all 8 pages + center-revealed), dynamic aria-label, arc stroke — ALL PASS.

**Bundle sizes after pass 5:** centers.json 2.04MB raw / 204KB gzip
(no regression — public/private split intact, no decodes in public bundle);
sproutData.js 3.16MB (untouched); styles.css 16.9KB raw / 4.2KB gzip.

**Verdict: fixes verified, no new issues — but the print-PDF review exposed a
real data-truth bug, fixed in pass 6.**

## Pass 6 — 2026-09-30: violation-rate truth fix (found via print PDF)

**The bug:** the print PDF showed "Flagged in 11 of 17 inspections (0%
violation rate) — better than the NYC average." The `rate` field comes from
the city's opaque per-row `violationratepercent` (NUESTROS NINOS's latest row
says 0), and the copy juxtaposed it with our own flagged/insp counts —
internally contradictory ("11 of 17 = 0%") and actively misleading: a center
flagged in 11 of 17 inspections was rated BETTER than average, and ranked #1
("cleaner than most nearby") in its ZIP.
**The fix (my scope only — sibling owns the generator):**
- `functions/api/_lib/data.js`: `teaserOf`, `fullReport`, and the nearby
  ranking now compute the center's violation rate as
  `round(100 * flag / insp)` from our own inspection counts instead of the
  city's per-row value. NUESTROS: "Flagged in 11 of 17 inspections (65%
  violation rate) vs 21.9% — worse than the NYC average"; nearby rank flips to
  a truthful 42 of 47. DC1000 teaser: 2 of 6 → 33% (was the city's 50%).
- `assets/data/centers.json`: all 3,014 public teaser entries had the buggy
  `standing` / `standing_display` / `standing_detail` strings baked in.
  `scripts/fix-standing.mjs` recomputed them with the same logic (insp, flag,
  cohort were already in each entry — nothing invented). 0 inconsistent
  entries; verdict distribution now 1356 worse / 489 near / 1169 better.
- Cohort average rounded to 1 decimal ("21.905%" → "21.9%").
- Standing detail phrase keeps "NYC" capitalized ("worse than the NYC
  average", not "the nyc average").
**Carry for the sibling worker:** their generator (`build-sproutscore-bundle.js`
/ `gen_centers.py` chain) still bakes the city's `violationratepercent` into
`rate` and into the SEO `centers/` pages' standing copy — the next data regen
would reintroduce the wrong verdicts there. Flag for a generator-side fix.
**Tests:** flow-test **17/17**, funnel-test **15/15**, audit-pages ALL PASS.
Screenshots pass6 (13 shots, re-shot after the fix) reviewed: revealed teaser
reads "Flagged in 2 of 6 inspections (33% violation rate) vs 21.9% — worse
than the NYC average"; MAJOR tags gold; score ring arc red; print PDF clean.

**Verdict: READY.** 13 planned fixes + 1 data-truth bug, all verified by tests
and two screenshot critique passes. Deliberately unfixed: sibling `centers/`
SEO copy (their files, flagged above); translations still PENDING_MAYOR_REVIEW
(pre-existing); live payment-status polling still unexercised from sandbox
(pre-existing). Do NOT deploy from this workstream — coordinator runs the
single final deploy.
