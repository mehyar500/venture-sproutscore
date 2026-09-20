// scripts/test-server.mjs — local harness: serves the static PWA and routes
// /api/* to the REAL Pages Functions modules with a mock D1 (LEADS_DB).
// This proves the actual handler code works (subscribe/unsubscribe/report)
// without touching production. Run: node scripts/test-server.mjs [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = parseInt(process.argv[2] || "8901", 10);
const TEST_UNSUB_SECRET = "sproutscore-test-secret";

// ── minimal D1 mock: supports exactly the SQL shapes our handlers use ──
function makeMockDb() {
  const tables = {
    sproutscore_subscribers: new Map(), // key: email
    subscribers_global: new Map(),      // key: email + "|" + brand
    sproutscore_orders: new Map(),      // key: access_token
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
        async all() { const r = await applyRead(q, this._params, tables); return { results: r }; },
      };
    },
  };
}

function applyWrite(q, p, t) {
  if (q.startsWith("INSERT INTO sproutscore_subscribers")) {
    const [email, source, center_id, center_name] = p;
    const row = t.sproutscore_subscribers.get(email) || { email };
    Object.assign(row, { email, status: "subscribed", source, center_id, center_name, unsubscribed_at: null });
    t.sproutscore_subscribers.set(email, row);
    return { success: true };
  }
  if (q.startsWith("INSERT INTO subscribers_global")) {
    const [email] = p;
    const key = email + "|sproutscore";
    const row = t.subscribers_global.get(key) || { email, brand: "sproutscore" };
    Object.assign(row, { email, brand: "sproutscore", status: "subscribed" });
    t.subscribers_global.set(key, row);
    return { success: true };
  }
  if (q.startsWith("UPDATE sproutscore_subscribers")) {
    const [email] = p;
    const row = t.sproutscore_subscribers.get(email);
    if (row) { row.status = "unsubscribed"; row.unsubscribed_at = new Date().toISOString(); }
    return { success: true };
  }
  if (q.startsWith("UPDATE subscribers_global")) {
    const [email] = p;
    const row = t.subscribers_global.get(email + "|sproutscore");
    if (row) row.status = "unsubscribed";
    return { success: true };
  }
  throw new Error("mock-db: unsupported write: " + q.slice(0, 80));
}

async function applyRead(q, p, t) {
  if (q.startsWith("SELECT center_id, status FROM sproutscore_orders")) {
    const row = t.sproutscore_orders.get(p[0]);
    return row ? [{ center_id: row.center_id, status: row.status }] : [];
  }
  throw new Error("mock-db: unsupported read: " + q.slice(0, 80));
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".webp": "image/webp",
};

const db = makeMockDb();
// seed one paid order for the token-gated report test
db._tables.sproutscore_orders.set("test-token-0123456789abcdef", {
  center_id: "sunshine-corner-daycare", status: "ready",
});

const env = { LEADS_DB: db, SPROUTSCORE_UNSUB_SECRET: TEST_UNSUB_SECRET };

async function handleApi(pathname, req, res) {
  // /api/report -> functions/api/report.js ; /api/_lib/* is not routable
  const rel = pathname.replace(/^\/api\//, "");
  if (!rel || rel.includes("..") || rel.startsWith("_lib")) {
    res.writeHead(404); res.end("nope"); return;
  }
  const file = path.join(ROOT, "functions", "api", rel + ".js");
  if (!fs.existsSync(file)) { res.writeHead(404); res.end("nope"); return; }
  const mod = await import(pathToFileURL(file).href + "?t=" + Date.now());
  const method = req.method.toUpperCase();
  const handler = mod["onRequest" + method[0] + method.slice(1).toLowerCase()] || mod.onRequest;
  if (!handler) { res.writeHead(405); res.end("method not allowed"); return; }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const bodyBuf = Buffer.concat(chunks);
  const url = new URL(pathname + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""), "http://localhost");
  const request = new Request(url.toString(), {
    method,
    headers: req.headers,
    body: bodyBuf.length && method !== "GET" && method !== "HEAD" ? bodyBuf : undefined,
  });
  try {
    const out = await handler({ request, env });
    const outBody = Buffer.from(await out.arrayBuffer());
    const headers = {};
    out.headers.forEach((v, k) => { headers[k] = v; });
    res.writeHead(out.status, headers);
    res.end(outBody);
  } catch (e) {
    console.error("api handler threw:", e);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "handler_threw" }));
  }
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(req.url.split("?")[0]);
  if (pathname.startsWith("/api/")) { handleApi(pathname, req, res); return; }
  let file = path.join(ROOT, pathname === "/" ? "index.html" : pathname.slice(1));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404, { "content-type": "text/plain" }); res.end("not found"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => console.log(`sproutscore test server on http://localhost:${PORT}`));
