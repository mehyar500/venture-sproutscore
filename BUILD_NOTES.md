# SproutScore build notes — 2026-09-19/20

## Test evidence (no real money, no real email, no production writes)

### flow-test.mjs — 14/14 PASS (2026-09-20)
Ran the REAL handler modules (`functions/api/subscribe.js`, `unsubscribe.js`,
`report.js`, `_lib/tokens.js`) against a mock D1 with the exact SQL shapes the
handlers use:
- invalid email → 400
- valid subscribe → 200, brand row `subscribed`, global row `subscribed` (brand=sproutscore)
- signed HMAC token minted with the production code path → one-click unsub → 200,
  both tables flipped to `unsubscribed`
- forged token → 400
- resubscribe after unsub → both tables back to `subscribed`
- report: short token → 403, bogus token → 404, valid token → 200 with 3 decoded
  violations + score 80/Grade B, `?demo=1` → 200 sample report
Re-run: `node scripts/flow-test.mjs`

### Screenshot review — two passes, 390×844
- `screenshots/pass1/` (13 shots) → 4 fixes in CRITIQUE.md → `screenshots/pass2/`
- Pass 2 verdict: ship. Zero horizontal scroll on all 8 pages (scrollW=390, 0 offenders,
  verified programmatically). Print/PDF view renders cleanly.
- Limitation: payment-status polling could not be exercised locally (mehyar.us
  unreachable from the sandbox) — verify with a real checkout on staging.

### HTML audit
- Every page links Privacy + Terms (footers + email-capture contexts).
- All internal hrefs resolve (one false-positive class: `data:` favicon URIs).
- All CSS classes used in markup are defined (removed one unused `.steps`).

## Data integration state
- Sibling output dir `~/workspace/sproutscore/data/` was EMPTY at check time.
- Stub data in place: 4 fictional centers, 7 decoded codes, sample banners on
  every page. `scripts/sync-data.sh` regenerates the teaser bundle + server
  dataset when the sibling lands (exits 2 with a clear message until then).

## Drip sequence — STAGED ONLY, nothing sent
`drip/01-free-result-recap.{txt,html}`, `02-decoded-sample.{txt,html}`,
`03-tour-questions.{txt,html}`, `04-last-call.{txt,html}`.
All carry `{{unsub_url}}` placeholders (signed tokens minted at send time) and
no fake urgency. Before any future send: mint `go.mehyar.us` links (currently
raw product URLs) and onboard `sproutscore.mehyar.us` on both ESPs.

## Blockers / open questions
1. **Repo `mehyar500/venture-sproutscore`**: creation attempts hit
   `RemoteDisconnected`/timeouts; a retry loop ran under `proc_14b3bfcdb376`.
   Check whether it landed; if not, retry the API, init main, commit, push via
   git-data (gh-push2.py pattern).
2. **D1 schema**: the Cloudflare D1 probe timed out 2026-09-20 — production
   availability of `subscribers_global` is unverified. Verify before launch;
   subscribe.js reports partial failures (502) rather than hiding them.
3. **Brand tag casing**: request said `sproutsScore`; implemented `sproutscore`
   (lowercase). Reconcile with the backend/global table convention if it matters.
4. **No refunds rule**: Terms say all sales final; failed/materially wrong reports
   are regenerated free. Sibling billing worker must honor the same language.
5. success.html treats `data.paid` as sufficient — confirm with the billing
   worker that no second fulfillment-readiness state is needed.
