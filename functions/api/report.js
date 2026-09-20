// functions/api/report.js
// GET /api/report — token-gated full decoded report.
//   ?token=<access_token>  — real buyer report. Looks up sproutscore_orders
//                            by access_token (written by the fulfillment hook
//                            at webhook time). 404 on bogus/short token.
//   ?demo=1                — sample report for preview/screenshots.
//                            Clearly watermarked in the UI; never a purchase.
//
// Response: { ok:true, demo?:true, report: <fullReport(center)> }

import { getCenter, fullReport } from "./_lib/data.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  if (url.searchParams.get("demo") === "1") {
    const center = await getCenter("DC1021"); // NUESTROS NINOS DAY CAR 1 — mixed severities
    if (!center) return json({ ok: false, error: "demo_unavailable" }, 503);
    return json({ ok: true, demo: true, report: await fullReport(center) });
  }

  const token = (url.searchParams.get("token") || "").trim();
  if (token.length < 16) return json({ ok: false, error: "bad_token" }, 403);

  const db = env.LEADS_DB;
  if (!db) return json({ ok: false, error: "no_db" }, 503);

  let order = null;
  try {
    order = await db
      .prepare("SELECT center_id, status FROM sproutscore_orders WHERE access_token=?")
      .bind(token)
      .first();
  } catch (e) {
    console.error("sproutscore/report lookup failed", e && e.message);
    return json({ ok: false, error: "store_failed" }, 502);
  }
  if (!order) return json({ ok: false, error: "unknown_order" }, 404);

  const center = await getCenter(order.center_id);
  if (!center) return json({ ok: false, error: "unknown_center" }, 404);

  return json({ ok: true, report: await fullReport(center) });
}
