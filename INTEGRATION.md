# INTEGRATION.md — SproutScore ↔ mehyar-web contract

How the centralized mehyar.us checkout/webhook talks to the SproutScore PWA.
(Sibling workers: billing registers the SKUs; fulfillment writes the orders.)

## SKUs (D1 `billing_products`, database `mehyar_leads_prod`)

| id | name | price | fulfillment |
|---|---|---|---|
| `sproutscore-report` | SproutScore Decoded Report | 1900¢ ($19) | `sproutscore` |
| `sproutscore-3pack` | SproutScore 3-Report Pack | 2900¢ ($29) | `sproutscore` |

- `success_url_template`: `https://sproutscore.mehyar.us/success.html?token={access_token}`
- `cancel_url`: `https://sproutscore.mehyar.us/`
- `allowed_return_hosts`: `sproutscore.mehyar.us`
- Seed SQL lives in `schema.sql` (sibling worker owns the actual D1 seed).
- **Price comes only from D1.** The frontend displays $19/$29 as a mirror of
  these rows; the webhook charges what D1 says.

## Checkout (frontend → mehyar.us)

`POST https://mehyar.us/api/pay/checkout`
```json
{
  "product_id": "sproutscore-report",
  "email": "buyer@example.com",
  "params": { "center_id": "sunshine-corner-daycare", "center_name": "Sunshine Corner Daycare" },
  "test": true,
  "success_url": "https://sproutscore.mehyar.us/success.html",
  "cancel_url": "https://sproutscore.mehyar.us/center.html?id=sunshine-corner-daycare"
}
```
`params` ≤ 2048 bytes; strings ≤ 2000 chars. Response `{ok, payment_id, token,
checkout_url}` → redirect buyer to `checkout_url`. The success page polls
`GET https://mehyar.us/api/pay/status?token=` directly (no local proxy).

## Webhook fulfillment (mehyar-web → SproutScore)

Register a `sproutscore` hook in `fulfillHooks` (`functions/api/pay/webhook.js`):

```js
async sproutscore({ db, env, waitUntil }, payment) {
  const { fulfillSproutscore } = await import("../_shared/fulfillSproutscore.js");
  const sendEmail = (e, msg) => sendCloudflareEmail(e, msg);
  await fulfillSproutscore({ db, env, waitUntil, sendEmail }, payment);
},
```

`fulfillSproutscore.js` contract (sibling fulfillment worker writes this):

- Read `payment.metadata_json` FLAT (`center_id`, `center_name` — checkout
  stores `params` flat; accept a `{inputs:{...}}` wrapper defensively).
- **Idempotent:** `UNIQUE(payment_id)` on `sproutscore_orders`; replays return
  `{replay:true}` and do nothing.
- Insert the order row with `status='ready'` (reports are data lookups —
  generation is instant), `access_token` = `payment.access_token` so ONE
  token gates every buyer surface.
- For `sproutscore-3pack`: same, plus the buyer redeems centers via
  `sproutscore_pack_uses` (UNIQUE(order_id, center_id)).
- Email the buyer from `team@mehyar.us` via injected `sendEmail`: subject
  "Your SproutScore report is ready 🌱", body with the report link
  `https://sproutscore.mehyar.us/report.html?token=<access_token>` and a
  one-click unsubscribe link (signed token — see below).
- Never throw out of the hook. On failure: mark order `failed`, do NOT email.

## Buyer surfaces (all token-gated on the billing `access_token`)

- `GET https://sproutscore.mehyar.us/api/report?token=` → `{ok, report}`
  (403 on short token, 404 on bogus token). Report JSON shape = `fullReport()`
  in `functions/api/_lib/data.js`.
- `report.html?demo=1` → sample report (watermarked "SAMPLE REPORT").
  Never linked from any purchase flow — preview/screenshots only.

## Subscribe / unsubscribe

- `POST /api/subscribe` `{email, source, center_id?, center_name?}` →
  writes `sproutscore_subscribers` (brand) + `subscribers_global`
  (brand='sproutscore'). 400 on invalid email, 502 on partial store failure.
- `GET /api/unsubscribe?token=<signed>` — one-click from email links.
  Token format: `base64url(email) + "." + hex(HMAC_SHA256(email, secret))`
  (see `functions/api/_lib/tokens.js`). Verified with `SPROUTSCORE_UNSUB_SECRET`.
- `GET /api/unsubscribe?email=` — the on-site form path.
- Both flip `sproutscore_subscribers` AND `subscribers_global`
  (brand='sproutscore') to `unsubscribed`. Browser hits 302 to
  `/unsubscribe.html?done=1`.
- **The mailer MUST share `SPROUTSCORE_UNSUB_SECRET`** so its unsubscribe
  links verify here. Drip templates use the `{{unsub_url}}` placeholder,
  substituted at send time with
  `https://sproutscore.mehyar.us/api/unsubscribe?token=<signed>`.

## Env vars (Pages project `sproutscore`, dashboard-set, never committed)

- `LEADS_DB` → D1 `mehyar_leads_prod`
- `SPROUTSCORE_UNSUB_SECRET` → shared with the mehyar-web mailer

## Sending domain

`sproutscore.mehyar.us` must be onboarded on BOTH ESPs before it sends.
Until then, all mail sends as `team@mehyar.us`.
