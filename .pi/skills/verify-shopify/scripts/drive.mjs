// Runs one flow module against SHOPIFY_URL in headless Chromium (VERIFY_HEADED=1 to watch); called by verify-shopify.sh, not directly.
import { appendFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const {
    SHOPIFY_URL,
    PLAYWRIGHT_HOME,
    EVIDENCE_DIR,
    VERIFY_LOCALE,
    VERIFY_WIDTH,
} = process.env;
const flowPath = process.argv[2];
if (!SHOPIFY_URL || !PLAYWRIGHT_HOME || !EVIDENCE_DIR || !flowPath) {
    console.error("drive.mjs is started by verify-shopify.sh flow");
    process.exit(2);
}

const require = createRequire(join(PLAYWRIGHT_HOME, "package.json"));
const { chromium, devices, expect } = require("@playwright/test");
const flow = (await import(pathToFileURL(flowPath).href)).default;

const out = (name) => join(EVIDENCE_DIR, name);
const log = (file, line) => appendFileSync(out(file), `${line}\n`);
const appOrigin = new URL(SHOPIFY_URL).origin;
// Polaris web components only exist as Shopify's CDN script (app/utils/polaris.ts).
const allowed = (u) =>
    u.origin === appOrigin || u.hostname === "cdn.shopify.com";

const browser = await chromium.launch({
    headless: process.env.VERIFY_HEADED !== "1",
});
const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: { width: Number(VERIFY_WIDTH), height: 900 },
    baseURL: SHOPIFY_URL,
    locale: VERIFY_LOCALE === "fr" ? "fr-FR" : "en-US",
});
const page = await context.newPage();

await context.route("**/*", (route) =>
    allowed(new URL(route.request().url()))
        ? route.fallback()
        : route.abort("blockedbyclient")
);

const pageErrors = [];
page.on("console", (m) => log("console.log", `[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => {
    pageErrors.push(e.message);
    log("console.log", `[pageerror] ${e.message}`);
});
context.on("requestfailed", (r) => {
    if (!allowed(new URL(r.url())))
        log(
            "network.log",
            `FAILED(${r.failure()?.errorText}) ${r.method()} ${r.url()}`
        );
});

/** Loads `path` (e.g. "/app/campaigns") with scenario params, then waits for the router and Polaris to settle. */
async function open(path, scenario = {}) {
    const query = new URLSearchParams({ ...scenario, lng: VERIFY_LOCALE });
    await page.goto(`/?${query}#${path}`);
    await page.waitForFunction(
        () => document.documentElement.dataset.harnessReady === "1",
        null,
        { timeout: 30_000 }
    );
    await page.evaluate(() => document.fonts.ready);
    // Deferred loader promises and Polaris upgrades land a frame or two after the router settles.
    await page.waitForTimeout(500);
}

let n = 0;
async function step(name) {
    const base = `${String(++n).padStart(2, "0")}-${name}`;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: out(`${base}.png`), fullPage: true });
    writeFileSync(
        out(`${base}.aria.yml`),
        await page.locator("body").ariaSnapshot()
    );
    log("steps.log", `${base} ${page.url()}`);
}

const only = process.env.VERIFY_ONLY ? `, only ${process.env.VERIFY_ONLY}` : "";
const label = `${flowPath} on ${SHOPIFY_URL} (chromium, ${VERIFY_WIDTH}px, ${VERIFY_LOCALE}${only})`;
let code = 0;
try {
    await flow({
        page,
        context,
        url: SHOPIFY_URL,
        locale: VERIFY_LOCALE,
        open,
        step,
        expect,
        pageErrors,
    });
    if (pageErrors.length)
        throw new Error(`page errors:\n${pageErrors.join("\n")}`);
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
