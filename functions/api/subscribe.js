// functions/api/subscribe.js
// POST /api/subscribe — opt-in email capture for SproutScore.
// Body: { email, source?, center_id?, center_name? }
//
// Writes to BOTH tables (sequential, honest about partial failure):
//   1. sproutscore_subscribers (brand list; keeps center_id/center_name)
//   2. subscribers_global      (brand='sproutscore')
// Resubscribing a previously-unsubscribed address flips status back to
// 'subscribed'.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

function clean(s, max) {
  s = String(s == null ? "" : s).trim();
  return s.length > max ? s.slice(0, max) : s;
}

export async function onRequestPost({ request, env }) {
  const db = env.LEADS_DB;
  if (!db) return json({ ok: false, error: "no_db" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const email = clean(body && body.email, 200).toLowerCase();
  const source = clean(body && body.source, 60) || "free-tier";
  const center_id = clean(body && body.center_id, 80);
  const center_name = clean(body && body.center_name, 160);
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "invalid_email" }, 400);

  // ── 1. brand table ──
  try {
    await db
      .prepare(
        `INSERT INTO sproutscore_subscribers (email, status, source, center_id, center_name, created_at, unsubscribed_at)
         VALUES (?, 'subscribed', ?, ?, ?, ${NOW}, NULL)
         ON CONFLICT(email) DO UPDATE SET
           status='subscribed', unsubscribed_at=NULL,
           source=excluded.source, center_id=excluded.center_id, center_name=excluded.center_name`
      )
      .bind(email, source, center_id || null, center_name || null)
      .run();
  } catch (e) {
    console.error("sproutscore/subscribe brand insert failed", e && e.message);
    return json({ ok: false, error: "brand_store_failed" }, 502);
  }

  // ── 2. global table (brand='sproutscore') ──
  try {
    await db
      .prepare(
        `INSERT INTO subscribers_global (email, brand, status, created_at, updated_at)
         VALUES (?, 'sproutscore', 'subscribed', ${NOW}, ${NOW})
         ON CONFLICT(email, brand) DO UPDATE SET
           status='subscribed', updated_at=${NOW}`
      )
      .bind(email)
      .run();
  } catch (e) {
    console.error("sproutscore/subscribe global insert failed", e && e.message);
    return json({ ok: false, error: "global_store_failed" }, 502);
  }

  console.log(`sproutscore/subscribed ${email} via ${source}`);
  return json({ ok: true, email });
}
