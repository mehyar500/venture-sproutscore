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
