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
