// scripts/audit-pages.mjs — pass-6 verification: zero horizontal overflow on all
// 8 pages at 390px, dynamic score-ring aria-label, arc stroke color.
import { chromium } from "playwright-core";
const EXE = "/home/hatch/.cache/ms-playwright/chrome-linux64/chrome";

const BASE = process.argv[2] || "http://localhost:8905";
const pages = [
  ["index", "/index.html", null],
  ["search", "/search.html?q=sunshine", null],
  ["center-masked", "/center.html?id=DC1000", null],
  ["center-revealed", "/center.html?id=DC1000", async (p) => {
    await p.evaluate(() => localStorage.setItem("sproutscore.reveal.DC1000", "1"));
    await p.reload();
  }],
  ["report", "/report.html?demo=1", null],
  ["success", "/success.html", null],
  ["privacy", "/privacy.html", null],
  ["terms", "/terms.html", null],
  ["unsubscribe", "/unsubscribe.html", null],
];

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let fail = 0;
for (const [name, path, prep] of pages) {
  await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(800);
  if (prep) { await prep(page); await page.waitForTimeout(800); }
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const wide = [];
    document.querySelectorAll("*").forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.width > 390.5) wide.push(el.tagName + "." + (el.className || "").toString().slice(0, 40));
    });
    return { scrollW: de.scrollWidth, overflow: [...new Set(wide)].slice(0, 5) };
  });
  const ok = r.scrollW <= 390.5 && r.overflow.length === 0;
  if (!ok) fail++;
  console.log((ok ? "PASS" : "FAIL") + "  overflow " + name + "  scrollW=" + r.scrollW + (r.overflow.length ? " wide=" + r.overflow.join("|") : ""));
}
// score ring checks on the demo report
await page.goto(BASE + "/report.html?demo=1", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const ring = await page.evaluate(() => {
  const ring = document.getElementById("score-ring");
  const arc = document.getElementById("score-arc");
  return {
    aria: ring.getAttribute("aria-label"),
    stroke: getComputedStyle(arc).stroke,
    dash: arc.style.strokeDashoffset,
  };
});
console.log("score-ring:", JSON.stringify(ring));
if (!/Safety score \d+ out of 100, Grade [A-F]/.test(ring.aria)) { console.log("FAIL  aria-label not dynamic"); fail++; }
else console.log("PASS  aria-label dynamic");
if (!ring.stroke || ring.stroke === "none" || ring.stroke.includes("var(")) { console.log("FAIL  arc stroke invalid: " + ring.stroke); fail++; }
else console.log("PASS  arc computed stroke=" + ring.stroke);
await browser.close();
console.log(fail === 0 ? "ALL PAGE AUDITS PASSED" : fail + " AUDIT(S) FAILED");
process.exit(fail ? 1 : 0);
