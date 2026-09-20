// SproutScore shared frontend helpers.
"use strict";

const CHECKOUT_URL = "https://mehyar.us/api/pay/checkout";
const PAY_STATUS_URL = "https://mehyar.us/api/pay/status";
const PRODUCT_REPORT = "sproutscore-report";
const PRODUCT_3PACK = "sproutscore-3pack";
const PRICE_REPORT = 19;
const PRICE_3PACK = 39;
// Prices are display mirrors of the billing_products rows (sibling worker
// registers the SKUs; the webhook charges only what D1 says).

async function startCheckout({ product_id, email, center_id, center_name, test }) {
  const body = {
    product_id,
    email,
    params: { center_id: center_id || "", center_name: (center_name || "").slice(0, 120) },
    success_url: "https://sproutscore.mehyar.us/success.html",
    cancel_url: "https://sproutscore.mehyar.us/center.html?id=" + encodeURIComponent(center_id || ""),
  };
  if (test === true) body.test = true;
  const res = await fetch(CHECKOUT_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* fall through */ }
  if (!res.ok || !data || !data.checkout_url) {
    const err = (data && data.error) || ("checkout_failed_" + res.status);
    throw new Error(err);
  }
  return data; // {ok, payment_id, token, checkout_url}
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function setStatus(el, msg, kind) {
  if (!el) return;
  el.textContent = msg || "";
  el.className = "status" + (kind ? " " + kind : "");
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

window.SproutScore = {
  startCheckout, getQueryParam, setStatus, esc, fmtDate,
  PRODUCT_REPORT, PRODUCT_3PACK, PRICE_REPORT, PRICE_3PACK,
  PAY_STATUS_URL,
};

// Register the service worker (PWA installability + offline shell).
// Guarded: only on secure contexts / localhost where SW is allowed.
if ("serviceWorker" in navigator && (window.isSecureContext || location.hostname === "localhost")) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () { /* offline is a nice-to-have */ });
  });
}
