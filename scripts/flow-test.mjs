// scripts/flow-test.mjs — subscribe → unsubscribe full-flow evidence.
// Runs the REAL handler modules (same import paths as test-server.mjs)
// against the mock D1, no HTTP needed. Prints verifiable state transitions.
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SECRET = "sproutscore-test-secret";

function makeMockDb() {
  const tables = {
    sproutscore_subscribers: new Map(),
    subscribers_global: new Map(),
    sproutscore_orders: new Map(),
  };
  return {
    _tables: tables,
    prepare(sql) {
      const q = sql.replace(/\s+/g, " ").trim();
      return {
        _params: [],
        bind(...p) { this._params = p; return this; },
        async run() { return applyWrite(q, this._params, tables); },
        async first() { const r = await applyRead(q, this._params, tables); return r[0] || null; },
      };
    },
  };
}
function applyWrite(q, p, t) {
  if (q.startsWith("INSERT INTO sproutscore_subscribers")) {
    const [email, source, center_id, center_name] = p;
    const row = t.sproutscore_subscribers.get(email) || { email };
    Object.assign(row, { email, status: "subscribed", source, center_id, center_name, unsubscribed_at: null });
    t.sproutscore_subscribers.set(email, row); return { success: true };
  }
  if (q.startsWith("INSERT INTO subscribers_global")) {
    const [email] = p; const key = email + "|sproutscore";
    const row = t.subscribers_global.get(key) || { email, brand: "sproutscore" };
    Object.assign(row, { status: "subscribed" }); t.subscribers_global.set(key, row);
    return { success: true };
  }
  if (q.startsWith("UPDATE sproutscore_subscribers")) {
    const row = t.sproutscore_subscribers.get(p[0]);
    if (row) { row.status = "unsubscribed"; row.unsubscribed_at = "2026-09-19T00:00:00Z"; }
    return { success: true };
  }
  if (q.startsWith("UPDATE subscribers_global")) {
    const row = t.subscribers_global.get(p[0] + "|sproutscore");
    if (row) row.status = "unsubscribed";
    return { success: true };
  }
  throw new Error("unsupported write " + q.slice(0, 60));
}
async function applyRead(q, p, t) {
  if (q.startsWith("SELECT center_id, status FROM sproutscore_orders")) {
    const row = t.sproutscore_orders.get(p[0]);
    return row ? [{ center_id: row.center_id, status: row.status }] : [];
  }
  throw new Error("unsupported read " + q.slice(0, 60));
}

const db = makeMockDb();
db._tables.sproutscore_orders.set("test-token-0123456789abcdef",
  { center_id: "DC1000", status: "ready" });
const env = { LEADS_DB: db, SPROUTSCORE_UNSUB_SECRET: SECRET };
const EMAIL = "flowtest-20260919@example.com";
const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (detail ? "  — " + detail : ""));
}

const subMod = await import(pathToFileURL(path.join(ROOT, "functions/api/subscribe.js")).href);
const unsubMod = await import(pathToFileURL(path.join(ROOT, "functions/api/unsubscribe.js")).href);
const reportMod = await import(pathToFileURL(path.join(ROOT, "functions/api/report.js")).href);
const { mintUnsubToken } = await import(pathToFileURL(path.join(ROOT, "functions/api/_lib/tokens.js")).href);

// 1. subscribe (invalid email → 400)
let r = await subMod.onRequestPost({ env, request: new Request("http://x/api/subscribe", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "not-an-email" }) }) });
check("subscribe rejects invalid email (400)", r.status === 400);

// 2. subscribe (valid)
r = await subMod.onRequestPost({ env, request: new Request("http://x/api/subscribe", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, source: "teaser", center_id: "sunshine-corner-daycare", center_name: "Sunshine Corner Daycare" }) }) });
let body = await r.json();
check("subscribe valid → 200 ok", r.status === 200 && body.ok === true, JSON.stringify(body));
check("brand table row subscribed", db._tables.sproutscore_subscribers.get(EMAIL)?.status === "subscribed");
check("global table row subscribed (brand=sproutscore)", db._tables.subscribers_global.get(EMAIL + "|sproutscore")?.status === "subscribed");

// 3. mint signed token (same code path the mailer will use) → one-click unsubscribe
const token = await mintUnsubToken(EMAIL, SECRET);
r = await unsubMod.onRequestGet({ env, request: new Request(`http://x/api/unsubscribe?token=${encodeURIComponent(token)}`, {
  headers: { accept: "application/json" } }) });
body = await r.json();
check("signed token unsub → 200 ok", r.status === 200 && body.ok === true, JSON.stringify(body));
check("brand table flipped to unsubscribed", db._tables.sproutscore_subscribers.get(EMAIL)?.status === "unsubscribed");
check("global table flipped to unsubscribed", db._tables.subscribers_global.get(EMAIL + "|sproutscore")?.status === "unsubscribed");

// 4. forged token → 400
r = await unsubMod.onRequestGet({ env, request: new Request("http://x/api/unsubscribe?token=" + encodeURIComponent(token.slice(0, -2) + "ff"), {
  headers: { accept: "application/json" } }) });
check("forged token rejected (400)", r.status === 400);

// 5. resubscribe after unsub flips status back
r = await subMod.onRequestPost({ env, request: new Request("http://x/api/subscribe", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, source: "free-tier" }) }) });
body = await r.json();
check("resubscribe → 200 ok", r.status === 200 && body.ok === true);
check("brand table back to subscribed", db._tables.sproutscore_subscribers.get(EMAIL)?.status === "subscribed");

// 6. report gating
r = await reportMod.onRequestGet({ env, request: new Request("http://x/api/report?token=short", { headers: { accept: "application/json" } }) });
check("short token → 403", r.status === 403);
r = await reportMod.onRequestGet({ env, request: new Request("http://x/api/report?token=bogus-token-0123456789abcdef", { headers: { accept: "application/json" } }) });
check("bogus token → 404", r.status === 404);
r = await reportMod.onRequestGet({ env, request: new Request("http://x/api/report?token=test-token-0123456789abcdef", { headers: { accept: "application/json" } }) });
body = await r.json();
check("valid token → 200 with decoded report", r.status === 200 && body.ok === true && body.report?.violations?.length > 0,
  `violations=${body.report?.violations?.length}, score=${body.report?.score}, band=${body.report?.band}`);
r = await reportMod.onRequestGet({ env, request: new Request("http://x/api/report?demo=1", { headers: { accept: "application/json" } }) });
body = await r.json();
check("demo mode → 200 sample report", r.status === 200 && body.ok === true && body.demo === true);

const failed = results.filter((x) => !x.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
