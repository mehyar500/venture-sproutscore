// scripts/shoot.mjs — screenshot every key screen at iPhone 390px.
// Usage: node scripts/shoot.mjs [baseUrl] [outDir]
// Requires the test server running (scripts/test-server.mjs).
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:8901";
const OUT = process.argv[3] || "screenshots/pass1";
const EXE = "/home/hatch/.cache/ms-playwright/chrome-linux64/chrome";

const SHOTS = [
  // [name, url, {fullPage, waitMs, pdf}]
  ["01-landing-hero", "/index.html", { fullPage: false }],
  ["02-landing-scroll", "/index.html", { fullPage: true }],
  ["03-search-results", "/search.html?q=sunshine", { fullPage: true, waitMs: 1200 }],
  ["04-teaser-top", "/center.html?id=DC1000", { fullPage: false, waitMs: 1200 }],
  ["05-teaser-flags", "/center.html?id=DC1000", { fullPage: true, waitMs: 1200 }],
  ["06-teaser-paywall", "/center.html?id=DC1000", { fullPage: true, waitMs: 1200, scrollTo: "#paywall" }],
  ["07-report-top", "/report.html?demo=1", { fullPage: false, waitMs: 1500 }],
  ["08-report-full", "/report.html?demo=1", { fullPage: true, waitMs: 1500 }],
  ["09-report-print", "/report.html?demo=1", { pdf: true, waitMs: 1500 }],
  ["10-success", "/success.html?token=test-token-0123456789abcdef", { fullPage: true, waitMs: 2500 }],
  ["11-privacy", "/privacy.html", { fullPage: true }],
  ["12-terms", "/terms.html", { fullPage: true }],
  ["13-unsubscribe", "/unsubscribe.html", { fullPage: false }],
];

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on("console", (m) => { if (m.type() === "error") console.log("[page-error]", m.text().slice(0, 120)); });

const fs = await import("node:fs");
fs.mkdirSync(OUT, { recursive: true });

for (const [name, url, opt] of SHOTS) {
  try {
    await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 });
    if (opt.scrollTo) await page.evaluate((s) => document.querySelector(s)?.scrollIntoView(), opt.scrollTo);
    if (opt.fullPage) {
      // fullPage stitches repeat sticky elements — pin the header static for capture only
      await page.addStyleTag({ content: ".site-header{position:static !important}" });
    }
    await page.waitForTimeout(opt.waitMs || 800);
    if (opt.pdf) {
      await page.pdf({ path: `${OUT}/${name}.pdf`, format: "Letter", printBackground: true });
      console.log("saved", `${OUT}/${name}.pdf`);
    } else {
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!opt.fullPage });
      console.log("saved", `${OUT}/${name}.png`);
    }
  } catch (e) {
    console.log("FAILED", name, e.message.slice(0, 120));
  }
}
await browser.close();
