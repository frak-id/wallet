// Runs one flow module against BUSINESS_URL in Chromium (headless unless VERIFY_HEADED=1); called by verify-business.sh, not directly.
import { appendFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const {
    BUSINESS_URL,
    PLAYWRIGHT_HOME,
    EVIDENCE_DIR,
    VERIFY_AUTH,
    VERIFY_LOCALE,
    VERIFY_WIDTH,
    VERIFY_WELCOME,
} = process.env;
const flowPath = process.argv[2];
if (!BUSINESS_URL || !PLAYWRIGHT_HOME || !EVIDENCE_DIR || !flowPath) {
    console.error("drive.mjs is started by verify-business.sh flow");
    process.exit(2);
}

const MERCHANT_ID = "11111111-1111-1111-1111-111111111111";
const require = createRequire(join(PLAYWRIGHT_HOME, "package.json"));
const { chromium, devices, expect } = require("@playwright/test");
const flow = (await import(pathToFileURL(flowPath).href)).default;

const out = (name) => join(EVIDENCE_DIR, name);
const log = (file, line) => appendFileSync(out(file), `${line}\n`);
const appOrigin = new URL(BUSINESS_URL).origin;

const browser = await chromium.launch({
    headless: process.env.VERIFY_HEADED !== "1",
});
const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: { width: Number(VERIFY_WIDTH), height: 900 },
    baseURL: BUSINESS_URL,
    locale: VERIFY_LOCALE,
});
const page = await context.newPage();

// Demo mode still calls the backend, listener and chain for a few things it does not mock; none of it may leave the machine.
await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === appOrigin
        ? route.fallback()
        : route.abort("blockedbyclient")
);
if (VERIFY_WELCOME !== "1") {
    await page.addInitScript(() =>
        localStorage.setItem(
            "business_welcomePopup_v1",
            JSON.stringify({ state: { hasSeenWelcome: true }, version: 0 })
        )
    );
}

page.on("console", (m) => log("console.log", `[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => log("console.log", `[pageerror] ${e.message}`));
context.on("requestfailed", (r) => {
    if (new URL(r.url()).origin !== appOrigin)
        log(
            "network.log",
            `FAILED(${r.failure()?.errorText}) ${r.method()} ${r.url()}`
        );
});

let n = 0;
async function step(name) {
    const base = `${String(++n).padStart(2, "0")}-${name}`;
    // The header and sidebar are position: fixed, so a full-page shot of a scrolled window paints them mid-image.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: out(`${base}.png`), fullPage: true });
    writeFileSync(
        out(`${base}.aria.yml`),
        await page.locator("body").ariaSnapshot()
    );
    log("steps.log", `${base} ${page.url()}`);
}

const label = `${flowPath} on ${BUSINESS_URL} (${VERIFY_WIDTH}px, ${VERIFY_LOCALE}, auth=${VERIFY_AUTH})`;
let code = 0;
try {
    if (VERIFY_AUTH === "demo") {
        await page.goto("/demo");
        await page.waitForURL(/\/m\/[^/]+\/dashboard$/);
    } else {
        await page.goto("/login");
    }
    await flow({
        page,
        context,
        url: BUSINESS_URL,
        merchantId: MERCHANT_ID,
        step,
        expect,
    });
    writeFileSync(out("verdict.txt"), `PASS ${label}\n`);
} catch (error) {
    code = 1;
    await page
        .screenshot({ path: out("FAIL.png"), fullPage: true })
        .catch(() => {});
    const aria = await page
        .locator("body")
        .ariaSnapshot()
        .catch(() => "");
    writeFileSync(out("FAIL.aria.yml"), aria);
    writeFileSync(
        out("verdict.txt"),
        `FAIL ${label}\nat ${page.url()}\n${error?.stack ?? error}\n`
    );
} finally {
    await browser.close();
}
process.exit(code);
