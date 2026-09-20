// scripts/funnel-test.mjs — end-to-end funnel evidence at 390×844.
// masked pre-capture → capture → reveal → persistence → failed-capture → paid gating.
// Spins up scripts/test-server.mjs (real handler code, mock D1) and drives it with Playwright.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8907;
const BASE = `http://localhost:${PORT}`;
const EXE = "/home/hatch/.cache/ms-playwright/chrome-linux64/chrome";
const CENTER = "DC1000";

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond });
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (detail ? "  — " + detail : ""));
}

const server = spawn("node", ["scripts/test-server.mjs", String(PORT)], { cwd: ROOT, stdio: "pipe" });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("server start timeout")), 15000);
  server.stdout.on("data", (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
  server.stderr.on("data", (d) => process.stderr.write("[server] " + d));
});
server.on("exit", (c) => console.log("[server exited]", c));

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
try {
  // ── T1: pre-capture masked ──
  let ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let page = await ctx.newPage();
  await page.goto(`${BASE}/center.html?id=${CENTER}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#hook-sec:not(.hidden)", { timeout: 8000 });
  const hookVisible = await page.locator("#hook-sec").isVisible();
  const freeHidden = await page.locator("#free-result.hidden").count();
  const hookText = await page.locator("#hook-sec").innerText();
  const hookDigits = (hookText.match(/\d+/g) || []).filter((d) => !/2020|2023/.test(d));
  const rInspPre = await page.locator("#r-inspections").textContent();
  const baRaw = await page.locator("#ba-raw").innerText();
  check("T1 hook visible, free result hidden pre-capture", hookVisible && freeHidden === 1);
  check("T1 masked glyphs, no readable counts in hook", /◆/.test(hookText) && hookDigits.length === 0, `digits=${JSON.stringify(hookDigits)}`);
  check("T1 reveal targets still dashes", rInspPre.trim() === "—", `r-inspections=${rInspPre.trim()}`);
  check("T1 paywall before-after masked pre-capture", /masked until you reveal/i.test(baRaw));
  const bannerPre = await page.locator("#hook-sec .stale-banner").innerText();
  check("T1 stale-data banner present pre-capture", /has not published newer daycare inspection data since April 2023/.test(bannerPre));

  // ── T2: successful capture → reveal ──
  await page.fill("#c-email", "funnel-test-20260920@example.com");
  await page.click("#capture-btn");
  await page.waitForSelector("#free-result:not(.hidden)", { timeout: 8000 });
  const rInsp = await page.locator("#r-inspections").textContent();
  const rFlag = await page.locator("#r-flagged").textContent();
  const flagsVisible = await page.locator("#flags-sec:not(.hidden)").count();
  const cleanVisible = await page.locator("#clean-sec:not(.hidden)").count();
  const ls = await page.evaluate((k) => localStorage.getItem(k), `ss_reveal_${CENTER}`);
  const bannerPost = await page.locator("#free-result .stale-banner").innerText();
  check("T2 reveal shows numeric counts", /^\d+$/.test(rInsp.trim()) && /^\d+$/.test(rFlag.trim()), `insp=${rInsp.trim()} flag=${rFlag.trim()}`);
  check("T2 flags or clean section revealed", flagsVisible + cleanVisible === 1);
  check("T2 reveal persisted to localStorage", ls === "1");
  check("T2 stale-data banner present post-reveal", /has not published newer daycare inspection data since April 2023/.test(bannerPost));
  check("T2 hook + capture sections hidden after reveal",
    (await page.locator("#hook-sec.hidden").count()) === 1 && (await page.locator("#capture-sec.hidden").count()) === 1);
  await ctx.close();

  // ── T3: persistence across reload ──
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  await page.addInitScript((k) => localStorage.setItem(k, "1"), `ss_reveal_${CENTER}`);
  await page.goto(`${BASE}/center.html?id=${CENTER}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#free-result:not(.hidden)", { timeout: 8000 });
  const rInsp3 = await page.locator("#r-inspections").textContent();
  check("T3 reload restores revealed state without re-capture", /^\d+$/.test(rInsp3.trim()));
  await ctx.close();

  // ── T4: failed capture stays masked ──
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  await page.route("**/api/subscribe", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await page.goto(`${BASE}/center.html?id=${CENTER}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#hook-sec:not(.hidden)", { timeout: 8000 });
  await page.fill("#c-email", "funnel-fail@example.com");
  await page.click("#capture-btn");
  await page.waitForSelector("#capture-status", { timeout: 5000 });
  await page.waitForTimeout(1500);
  const stillMasked = (await page.locator("#free-result.hidden").count()) === 1;
  const statusTxt = await page.locator("#capture-status").innerText();
  check("T4 failed capture stays masked", stillMasked && /try again/i.test(statusTxt), `status=${statusTxt.slice(0, 60)}`);
  await ctx.close();

  // ── T5: paid upgrade still gated ──
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  await page.goto(`${BASE}/center.html?id=${CENTER}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#paywall", { timeout: 8000 });
  await page.evaluate(() => document.querySelector("#paywall").scrollIntoView());
  await page.click("#buy-btn");
  const payStatus = await page.locator("#pay-status").innerText();
  check("T5 buy without email shows gated error", /enter your email first/i.test(payStatus));
  await ctx.close();

  // ── T6: search results don't leak counts ──
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  await page.goto(`${BASE}/search.html?q=sunshine`, { waitUntil: "networkidle" });
  await page.waitForSelector("#results:not(.hidden)", { timeout: 8000 });
  const resText = await page.locator("#results").innerText();
  check("T6 search rows show no flagged counts", !/flagged of \d+ inspections/i.test(resText) && /tap to check/i.test(resText));
  await ctx.close();

  // ── T7: overflow audit 390×844 ──
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  const urls = ["/index.html", "/search.html?q=sunshine", `/center.html?id=${CENTER}`, "/report.html?demo=1", "/privacy.html", "/terms.html"];
  let overflow = [];
  for (const u of urls) {
    await page.goto(BASE + u, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > 390) overflow.push(`${u}: scrollWidth=${sw}`);
  }
  check("T7 no horizontal overflow at 390px", overflow.length === 0, overflow.join("; ") || "all ≤390");
  await ctx.close();
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((x) => !x.pass);
console.log(`\n${results.length - failed.length}/${results.length} funnel checks passed`);
process.exit(failed.length ? 1 : 0);
