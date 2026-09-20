// functions/api/unsubscribe.js
// GET /api/unsubscribe — one-click unsubscribe, honored in BOTH tables.
//   ?email=a@b.com        — direct one-click (from the on-site form)
//   ?token=<signed>       — one-click from an email link (see _lib/tokens.js)
//
// Sets status='unsubscribed' in sproutscore_subscribers (plus unsubscribed_at)
// and in subscribers_global WHERE brand='sproutscore'.
// Browser hits get a friendly redirect to /unsubscribe.html?done=1;
// API clients get JSON.

import { verifyUnsubToken } from "./_lib/tokens.js";

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestGet({ request, env }) {
  const db = env.LEADS_DB;
  if (!db) return json({ ok: false, error: "no_db" }, 503);

  const url = new URL(request.url);
  const emailParam = (url.searchParams.get("email") || "").trim().toLowerCase();
  const tokenParam = url.searchParams.get("token") || "";
  const wantsHtml = (request.headers.get("accept") || "").includes("text/html");

  let email = null;
  if (tokenParam) {
    const secret = env.SPROUTSCORE_UNSUB_SECRET || "sproutscore-unsub-dev";
    email = await verifyUnsubToken(tokenParam, secret);
    if (!email) {
      if (wantsHtml) return Response.redirect(new URL("/unsubscribe.html?err=badtoken", url).toString(), 302);
      return json({ ok: false, error: "bad_token" }, 400);
    }
  } else if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailParam)) {
    email = emailParam;
  } else {
    if (wantsHtml) return Response.redirect(new URL("/unsubscribe.html", url).toString(), 302);
    return json({ ok: false, error: "missing_email" }, 400);
  }

  try {
    await db
      .prepare(
        `UPDATE sproutscore_subscribers
         SET status='unsubscribed', unsubscribed_at=${NOW}
         WHERE email=?`
      )
      .bind(email)
      .run();
    await db
      .prepare(
        `UPDATE subscribers_global
         SET status='unsubscribed', updated_at=${NOW}
         WHERE email=? AND brand='sproutscore'`
      )
      .bind(email)
      .run();
  } catch (e) {
    console.error("sproutscore/unsubscribe failed", e && e.message);
    return json({ ok: false, error: "store_failed" }, 502);
  }

  console.log(`sproutscore/unsubscribed ${email}`);
  if (wantsHtml) return Response.redirect(new URL("/unsubscribe.html?done=1", url).toString(), 302);
  return json({ ok: true, email });
}
