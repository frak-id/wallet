import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Route } from "@playwright/test";

const USAGE =
    "Usage: bun run try:merchant <store-page-url> [--image <url>|none] [--with-content] [--shot] [--password <storefront password>]\n" +
    "Opens the store with the local cdn/ build in place of the published SDK and shows <frak-ambassador> in place of the page content.\n" +
    "The hero photo defaults to the page's og:image; `--image none` shows the collapsed frame.\n" +
    "The theme is sampled from the bare page, as on a real dedicated page; `--with-content` samples it with the store's content still there.";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        image: { type: "string" },
        password: { type: "string" },
        shot: { type: "boolean" },
        "with-content": { type: "boolean" },
    },
});
const url = positionals[0];
const shot = values.shot ?? false;
if (!url || !URL.canParse(url)) {
    console.error(USAGE);
    process.exit(1);
}

const cdnDir = join(import.meta.dir, "..", "cdn");
if (!existsSync(join(cdnDir, "loader.js"))) {
    console.error(
        "No local build: run `bun run build:sdk` from the repo root."
    );
    process.exit(1);
}

// Merchants load either sdk.frak.id/components.js or the jsdelivr package; both
// end up importing jsdelivr's cdn/loader.js and its chunks, which we serve locally.
function serveLocal(route: Route) {
    const file = route
        .request()
        .url()
        .match(/\/cdn\/([^/?#]+\.js)(?:[?#]|$)/)?.[1];
    const path = join(
        cdnDir,
        file && existsSync(join(cdnDir, file)) ? file : "components.js"
    );
    return route.fulfill({
        body: readFileSync(path),
        headers: {
            "content-type": "application/javascript",
            "access-control-allow-origin": "*",
        },
    });
}

const browser = await chromium
    .launch({ channel: "chrome", headless: shot })
    .catch(() => chromium.launch({ headless: shot }));
// A headed window drives its own size; screenshots need a fixed one.
const context = await browser.newContext({
    bypassCSP: true,
    // Stores negotiate their language, and our merchants are French.
    locale: "fr-FR",
    viewport: shot ? { width: 1280, height: 900 } : null,
});
await context.route("https://sdk.frak.id/components.js*", serveLocal);
await context.route(
    "https://cdn.jsdelivr.net/npm/@frak-labs/components**",
    serveLocal
);

const page = await context.newPage();
await page.goto(url, { waitUntil: "load", timeout: 60_000 });
if (new URL(page.url()).pathname === "/password") {
    const password = values.password;
    if (!password) {
        console.error("The store is password-protected: pass --password.");
        await browser.close();
        process.exit(1);
    }
    // Themes often keep the field in a closed modal, so submit without clicking.
    await page.evaluate((value) => {
        const input = document.querySelector<HTMLInputElement>(
            'form[action*="/password"] input[type="password"]'
        );
        if (!input?.form) throw new Error("No storefront password form.");
        input.value = value;
        input.form.submit();
    }, password);
    await page
        .waitForURL((next) => next.pathname !== "/password", {
            timeout: 15_000,
        })
        .catch(() => {
            console.error("The storefront password was not accepted.");
            process.exit(1);
        });
    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
}
const hasFrak = await page.evaluate(() => "FrakSetup" in window);
if (!hasFrak) {
    // A store without Frak: load the SDK ourselves so the layout and theme still show.
    await page.evaluate(() => {
        const siteName = document
            .querySelector('meta[property="og:site_name"]')
            ?.getAttribute("content");
        Object.assign(window, {
            FrakSetup: {
                config: {
                    metadata: { name: siteName || location.hostname },
                },
            },
        });
        const script = document.createElement("script");
        script.type = "module";
        script.src =
            "https://cdn.jsdelivr.net/npm/@frak-labs/components/cdn/loader.js";
        document.head.append(script);
    });
}
const withContent = values["with-content"] ?? false;
// A page already placing the element (the Shopify block) is shown as it is.
const placed = await page.evaluate(
    () => document.querySelector("frak-ambassador") !== null
);
// Stage a dedicated merchant page with the inject snippet's rules: the content
// region gives way to a centred column, site header and footer stay.
if (!placed)
    await page.evaluate(
        ([image, keepContent]) => {
            const chromeSelector =
                "header, footer, [role=banner], [role=contentinfo], .skip-link";
            const host =
                document.querySelector("#main") ??
                document.querySelector("main, [role=main]") ??
                document.body;
            const depth = (el: Element) => {
                let d = 0;
                for (let n: Element | null = el; n && n !== document.body; ) {
                    d++;
                    n = n.parentElement;
                }
                return d;
            };
            // A <header> deep in the content is a card's, not the site's.
            const chrome = Array.from(
                host.querySelectorAll(chromeSelector)
            ).filter((el) => depth(el) <= 4);
            const content: Element[] = [];
            const collect = (parent: Element) => {
                for (const el of parent.children) {
                    if (el.id.startsWith("frak-") || chrome.includes(el))
                        continue;
                    if (chrome.some((node) => el.contains(node))) collect(el);
                    else content.push(el);
                }
            };
            collect(host);
            for (const el of content) {
                el.setAttribute("data-frak-try-hidden", "");
                if (!keepContent) (el as HTMLElement).style.display = "none";
            }
            const banner = chrome.find((el) =>
                el.matches("header, [role=banner]")
            );
            const anchor =
                (banner &&
                    content.find(
                        (el) =>
                            banner.compareDocumentPosition(el) &
                            Node.DOCUMENT_POSITION_FOLLOWING
                    )) ??
                content[0];

            const column = document.createElement("div");
            column.style.cssText =
                "max-width:1100px;margin:60px auto;padding:0 20px";
            const ambassador = document.createElement("frak-ambassador");
            const heroImage =
                image ??
                document
                    .querySelector('meta[property="og:image"]')
                    ?.getAttribute("content");
            if (heroImage && heroImage !== "none") {
                ambassador.setAttribute("hero-image-url", heroImage);
            }
            column.append(ambassador);
            if (anchor) anchor.before(column);
            else host.append(column);
        },
        [values.image ?? null, withContent] as const
    );
const root = page.locator(".frak-ambassador");
await root.waitFor({ timeout: 20_000 });
// With --with-content, the content goes only once the theme is sampled, as the inject snippet did.
await page
    .waitForSelector('.frak-ambassador[style*="--frak-amb-"]', {
        timeout: 5000,
    })
    .catch(() => console.warn("No theme sampled: the shipped defaults show."));
await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>(
        "[data-frak-try-hidden]"
    )) {
        el.style.display = "none";
    }
});
await root.scrollIntoViewIfNeeded();
if (!hasFrak) {
    console.warn(
        "No Frak SDK at page load, so it was injected: rewards show only if this domain is a Frak merchant."
    );
}

if (!shot) {
    console.log("Browsing with the local build. Close the window to exit.");
    await new Promise((resolve) => page.on("close", resolve));
    await browser.close();
    process.exit(0);
}

// Let the rewards and theme settle, then hide the store's popups for a clean capture.
await page.waitForTimeout(8000);
const hideOverlays = () =>
    page.evaluate(() => {
        const ours = document.querySelector(".frak-ambassador");
        for (const el of document.querySelectorAll<HTMLElement>("body *")) {
            const position = getComputedStyle(el).position;
            if (
                (position === "fixed" || position === "sticky") &&
                !el.contains(ours) &&
                !ours?.contains(el)
            ) {
                el.style.display = "none";
            }
        }
    });
const host = page.url().split("/")[2] ?? "store";
for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(1500);
    await hideOverlays();
    const path = join(tmpdir(), `frak-ambassador-${host}-${width}.png`);
    await root.screenshot({ path });
    // Only our own overflow counts: plenty of stores already scroll sideways.
    const overflow = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".frak-ambassador *")).some(
            (el) => el.getBoundingClientRect().right > window.innerWidth + 1
        )
    );
    console.log(
        `${width}px: ${path}${overflow ? " (the component overflows)" : ""}`
    );
}
console.log("Sampled theme:", await root.getAttribute("style"));
await browser.close();
