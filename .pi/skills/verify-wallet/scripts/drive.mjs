// Runs one flow module against WALLET_URL in Chromium (headless unless VERIFY_HEADED=1); called by verify-wallet.sh, not directly.
import { appendFileSync, writeFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// The light mocks import each other without extensions, as the repo's bundlers allow and node does not.
registerHooks({
    resolve(specifier, context, next) {
        try {
            return next(specifier, context);
        } catch (error) {
            const fromTs = context.parentURL?.endsWith(".ts");
            if (
                error?.code !== "ERR_MODULE_NOT_FOUND" ||
                !fromTs ||
                !specifier.startsWith(".")
            )
                throw error;
            return next(`${specifier}.ts`, context);
        }
    },
});

const {
    WALLET_URL,
    WALLET_DIR,
    EVIDENCE_DIR,
    VERIFY_AUTH,
    VERIFY_DEVICE,
    VERIFY_MAP,
    VERIFY_REAL_AUTH,
    VERIFY_CREDENTIAL,
} = process.env;
const realDev = VERIFY_AUTH === "real-dev";
const flowPath = process.argv[2];
if (!WALLET_URL || !WALLET_DIR || !EVIDENCE_DIR || !flowPath) {
    console.error("drive.mjs is started by verify-wallet.sh flow");
    process.exit(2);
}

const require = createRequire(join(WALLET_DIR, "package.json"));
const { chromium, webkit, devices, expect } = require("@playwright/test");
const profile = devices[VERIFY_DEVICE ?? "Pixel 7"];
const onWebkit = profile.defaultBrowserType === "webkit";
const fromWallet = (p) => import(pathToFileURL(join(WALLET_DIR, p)).href);
const { mockDefaultApiRoutes } = await fromWallet("tests-light/mocks/api.ts");
const { sessionStoreValue, unauthenticatedSessionStoreValue } =
    await fromWallet("tests-light/mocks/sessions.ts");
const flow = (await import(pathToFileURL(flowPath).href)).default;

const out = (name) => join(EVIDENCE_DIR, name);
const log = (file, line) => appendFileSync(out(file), `${line}\n`);
const appOrigin = new URL(WALLET_URL).origin;

// Real-dev: the page origin is wallet-dev.frak.id resolved to the local server; the service worker refuses its mkcert cert without the flag.
const browser = await (onWebkit ? webkit : chromium).launch({
    headless: process.env.VERIFY_HEADED !== "1",
    args: realDev
        ? [
              "--ignore-certificate-errors",
              `--host-resolver-rules=MAP ${VERIFY_MAP}`,
          ]
        : [],
});
const context = await browser.newContext({
    ...profile,
    baseURL: WALLET_URL,
    ignoreHTTPSErrors: true,
    locale: "en-US",
    // WebKit rejects the clipboard permissions, and does not route requests its service worker relays.
    permissions: onWebkit ? [] : ["clipboard-read", "clipboard-write"],
    serviceWorkers: onWebkit ? "block" : "allow",
});
const page = await context.newPage();

if (!realDev) {
    // Registered first so it runs last: anything the light mocks do not answer and that leaves the app origin is blocked.
    await page.route("**/*", (route) =>
        new URL(route.request().url()).origin === appOrigin
            ? route.fallback()
            : route.abort("blockedbyclient")
    );
    await mockDefaultApiRoutes(page, WALLET_URL);
    await page.addInitScript(
        (session) =>
            localStorage.setItem("frak_session_store", JSON.stringify(session)),
        VERIFY_AUTH === "out"
            ? unauthenticatedSessionStoreValue
            : sessionStoreValue
    );
}

/** Mirrors apps/wallet/tests/global.setup.ts: log in with the persisted passkey, register it when that fails. */
async function realDevLogin() {
    const { MockedWebAuthNHelper, AuthPage } = await import(
        pathToFileURL(VERIFY_REAL_AUTH).href
    );
    const passkey = new MockedWebAuthNHelper(page);
    // The bundle resolves the e2e storage dir relative to itself; point it at the skill's own credential.
    passkey.authenticatorFile = VERIFY_CREDENTIAL;
    await passkey.setup();
    const auth = new AuthPage(page);
    let mode = "login";
    if (!passkey.isFreshCredential) {
        await auth.navigateToLogin();
        await auth.verifyLoginReady();
        await auth.clickLogin();
    }
    const loggedIn = await page
        .waitForURL(/\/wallet$/, {
            timeout: passkey.isFreshCredential ? 1 : 15_000,
        })
        .then(
            () => true,
            () => false
        );
    if (!loggedIn) {
        mode = "register";
        await auth.navigateToRegister();
        await auth.verifyRegistrationReady();
        await auth.clickRegisterSkippingEmail();
        await auth.completeOnboarding();
    }
    const session = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("frak_session_store") ?? "{}")
    );
    const address = session?.state?.session?.address;
    if (!address)
        throw new Error(`real-dev ${mode} finished without a session`);
    writeFileSync(
        out("account.txt"),
        `address=${address}\nvia=${mode}\ncredential=${VERIFY_CREDENTIAL}\n`
    );
}

page.on("console", (m) => log("console.log", `[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => log("console.log", `[pageerror] ${e.message}`));
page.on("requestfinished", async (r) => {
    if (new URL(r.url()).origin === appOrigin) return;
    const res = await r.response();
    log("network.log", `${res?.status() ?? "-"} ${r.method()} ${r.url()}`);
});
page.on("requestfailed", (r) => {
    if (new URL(r.url()).origin !== appOrigin)
        log(
            "network.log",
            `FAILED(${r.failure()?.errorText}) ${r.method()} ${r.url()}`
        );
});

let n = 0;
async function step(name) {
    const base = `${String(++n).padStart(2, "0")}-${name}`;
    await page.screenshot({ path: out(`${base}.png`), fullPage: true });
    writeFileSync(
        out(`${base}.aria.yml`),
        await page.locator("body").ariaSnapshot()
    );
    log("steps.log", `${base} ${page.url()}`);
}

const label = `${flowPath} on ${WALLET_URL} (${VERIFY_DEVICE}, auth=${VERIFY_AUTH})`;
let code = 0;
try {
    if (realDev) await realDevLogin();
    await flow({ page, context, url: WALLET_URL, step, expect });
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
