import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import {
    CLIENT_ID,
    MERCHANT_ID,
    mockDefaultApiRoutes,
    REFERRER_REWARD_EUR,
} from "../mocks/api";
import { RETURN_SCHEME, recordHostResults } from "../mocks/nativeHost";

/**
 * Visual checks for the `/sharing` page as a native SDK web view renders it.
 *
 * The sheets on both platforms draw a skeleton over a transparent web view, so
 * every pixel comes from this page. These specs drive it through the same URL
 * contract `SharingPageUrl` builds, at the viewports a sheet presents.
 */

declare global {
    interface Window {
        /** Set by the copy spec; a reload wipes it. */
        __documentToken?: number;
    }
}

/** Viewports a native sheet actually presents this page at. */
const VIEWPORTS = {
    iphone: { width: 390, height: 844 },
    android: { width: 412, height: 915 },
    /** The tablet cascade case: `containerChromeless` must cancel the card treatment. */
    ipad: { width: 768, height: 1024 },
    /** `heightFraction` floor — 0.3 of an iPhone. */
    short: { width: 390, height: 279 },
    landscape: { width: 844, height: 390 },
} as const;

const PRODUCTS = [
    {
        title: "Babies camel cuir velours bout carré",
        link: "https://acme.example.com/p/1",
        imageUrl: "https://cdn.example.com/1.png",
    },
    {
        title: "Sneakers blanches classiques",
        link: "https://acme.example.com/p/2",
        imageUrl: "https://cdn.example.com/2.png",
    },
];

/** Mirrors `SharingPageUrl.build` — the URL a native sheet loads on tap. */
function sharingUrl(
    overrides: Record<string, string | undefined> = {},
    { native = true }: { native?: boolean } = {}
) {
    const params = new URLSearchParams({
        merchantId: MERCHANT_ID,
        link: "https://acme.example.com",
    });
    if (native) {
        params.set("embed", "native");
        params.set("clientId", CLIENT_ID);
        params.set("returnScheme", RETURN_SCHEME);
        params.set("sid", "s1");
        params.set("sdkVersion", "1.0.0-beta.1");
    }
    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) params.delete(key);
        else params.set(key, value);
    }
    return `/sharing?${params}`;
}

// A page carrying a `returnScheme` pings `action=ready` as soon as it paints,
// and Chromium never resolves that custom-scheme request, so `load` never
// fires. The SDK's own web view cancels the same navigation.
async function open(page: Page, url: string) {
    await page.goto(url, { waitUntil: "commit" });
}

/**
 * Wait for real content rather than `networkidle`: analytics keeps connections
 * alive, and an idle wait shoots a half-painted page.
 */
async function settle(page: Page) {
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await page.locator("footer button").last().waitFor({ state: "visible" });
    // The card tagline interpolates the resolved amount, so it appears only
    // once the reward query has replaced the loading skeleton.
    await expect(
        page.getByText(new RegExp(`(Gagnez|Earn)\\b.*${REFERRER_REWARD_EUR}`))
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
}

/** Every screenshot goes through here, so none of them can race a transition. */
async function shoot(page: Page, name: string) {
    await expect(page).toHaveScreenshot(name, { animations: "disabled" });
}

test.describe("Sharing page — native sheet", () => {
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
        test(`renders chromeless at ${name}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await open(
                page,
                sharingUrl({ products: JSON.stringify(PRODUCTS) })
            );
            await settle(page);

            await shoot(page, `sharing-native-${name}.png`);
        });
    }

    test("fills the viewport with no card treatment", async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.ipad);
        await open(page, sharingUrl());
        await settle(page);

        // A native sheet is full-bleed: any horizontal gap shows its scrim
        // down both edges of the page.
        const width = await page
            .getByRole("dialog")
            .evaluate((el) => el.getBoundingClientRect().width);
        expect(Math.round(width)).toBe(VIEWPORTS.ipad.width);
    });

    test("renders the web chrome when not embedded", async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.ipad);
        await open(page, sharingUrl({}, { native: false }));
        await settle(page);

        // The other half of the fix: a plain web visit keeps the centred card,
        // so the host opt-out must not leak into it.
        const card = await page.getByRole("dialog").evaluate((el) => {
            const style = getComputedStyle(el);
            return {
                width: Math.round(el.getBoundingClientRect().width),
                radius: style.borderTopLeftRadius,
                shadow: style.boxShadow,
            };
        });
        expect(card.width).toBeLessThan(VIEWPORTS.ipad.width);
        expect(card.radius).not.toBe("0px");
        expect(card.shadow).not.toBe("none");

        await shoot(page, "sharing-web-ipad.png");
    });
});

test.describe("Sharing page — warm then activate", () => {
    /** Same-document activation: no request, no remount. */
    async function activate(page: Page, fragment: string) {
        await page.evaluate((hash) => {
            window.location.hash = hash;
        }, fragment);
    }

    test("warms without content, then fills in on activation", async ({
        page,
    }) => {
        await page.setViewportSize(VIEWPORTS.iphone);

        // Warm: no link, no products — what the pool loads before any tap.
        await open(page, sharingUrl({ state: "warm", link: undefined }));
        await settle(page);
        await expect(page.getByText(PRODUCTS[0].title)).toHaveCount(0);
        await shoot(page, "sharing-warm.png");

        await activate(
            page,
            `sid=s1&state=live&link=${encodeURIComponent("https://acme.example.com")}&products=${encodeURIComponent(JSON.stringify(PRODUCTS))}`
        );

        await expect(page.getByText(PRODUCTS[0].title)).toBeVisible();
        await shoot(page, "sharing-activated.png");
    });

    test("a second activation replaces the first", async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.iphone);
        await open(page, sharingUrl({ state: "warm", link: undefined }));
        await settle(page);

        await activate(
            page,
            `sid=s1&state=live&products=${encodeURIComponent(JSON.stringify([PRODUCTS[0]]))}`
        );
        await expect(page.getByText(PRODUCTS[0].title)).toBeVisible();

        await activate(
            page,
            `sid=s2&state=live&products=${encodeURIComponent(JSON.stringify([PRODUCTS[1]]))}`
        );

        // Replaced, not merged: the first product is gone rather than listed
        // alongside the second.
        await expect(page.getByText(PRODUCTS[1].title)).toBeVisible();
        await expect(page.getByText(PRODUCTS[0].title)).toHaveCount(0);
        await shoot(page, "sharing-reactivated.png");
    });
});

test.describe("Sharing page — host bridge", () => {
    test("pings ready once painted", async ({ page }) => {
        const results = recordHostResults(page);
        await open(page, sharingUrl());
        await settle(page);

        // The signal the native skeleton waits on before cross-fading.
        await expect
            .poll(() => results.join(" "))
            .toContain("action=ready&sid=s1");
    });

    test("stays silent while warming", async ({ page }) => {
        const results = recordHostResults(page);
        await open(page, sharingUrl({ state: "warm" }));
        await settle(page);
        await page.waitForTimeout(500);

        // Nothing is on screen yet, so there is nothing to report as ready.
        expect(results.join(" ")).not.toContain("action=ready");
    });

    test("hands the share press to the host", async ({ page }) => {
        const results = recordHostResults(page);
        await open(page, sharingUrl());
        await settle(page);

        await page.getByRole("button", { name: /partager|share/i }).click();

        // The session token is echoed back so the host can correlate.
        await expect
            .poll(() => results.join(" "))
            .toContain("action=share&sid=s1");
    });

    test("hands the copy press over without reloading", async ({ page }) => {
        const results = recordHostResults(page);
        await open(page, sharingUrl());
        await settle(page);

        // Survives a same-document update and dies on a reload, so it is what
        // separates the two. Asserting the URL cannot: this test navigated to
        // it, and nothing here rewrites it.
        await page.evaluate(() => {
            window.__documentToken = Math.random();
        });

        await page.getByRole("button", { name: /copier|copy/i }).click();
        await expect.poll(() => results.join(" ")).toContain("action=copy");

        // A copy must not reload into the confirmation screen: the host has
        // already toasted, and a reload would tear that down mid-toast.
        expect(await page.evaluate(() => window.__documentToken)).toBeDefined();
        await expect(page.locator("footer button")).toHaveCount(2);
    });

    test("fills the clipboard even when nothing answers the scheme", async ({
        browser,
    }) => {
        // Its own context: `confirmation.ts` keeps one record per origin, and
        // the clipboard is shared within one too, so a sibling's copy would
        // satisfy a weaker assertion than this.
        const baseURL = test.info().project.use.baseURL;
        const context = await browser.newContext({
            baseURL,
            viewport: VIEWPORTS.iphone,
            permissions: ["clipboard-read", "clipboard-write"],
        });
        const page = await context.newPage();
        // Same origin the project uses, so first-party assets are not swapped
        // for the placeholder pixel.
        await mockDefaultApiRoutes(page, baseURL);

        await page.goto(sharingUrl(), { waitUntil: "commit" });
        await page
            .locator("footer button")
            .last()
            .waitFor({ state: "visible" });
        await page.getByRole("button", { name: /copier|copy/i }).click();

        // A shared link carries `returnScheme` into an ordinary browser, where
        // nothing intercepts it — and the page cannot tell, so its own write is
        // the only thing that leaves the user with a link.
        await expect
            .poll(() => page.evaluate(() => navigator.clipboard.readText()))
            .toContain("fCtx=");

        await context.close();
    });
});

test.describe("Sharing page — confirmation", () => {
    for (const [name, viewport] of [
        ["iphone", VIEWPORTS.iphone],
        ["ipad", VIEWPORTS.ipad],
    ] as const) {
        test(`renders the post-share screen at ${name}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await open(page, sharingUrl({ view: "confirmation" }));
            await page.getByRole("dialog").waitFor({ state: "visible" });
            await page.evaluate(() => document.fonts.ready);

            await shoot(page, `sharing-confirmation-${name}.png`);
        });
    }
});

test.describe("Sharing page — degraded", () => {
    test("drops the share CTA when no host can service it", async ({
        page,
    }) => {
        await page.setViewportSize(VIEWPORTS.iphone);
        // Removed rather than assumed: desktop Chromium happens not to expose
        // `share`, so this passed on an environmental fact it never stated —
        // and would go red for a browser change rather than a regression.
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "share", { value: undefined });
        });
        // With no `returnScheme` either, `canHandOff` is false and nothing is
        // left to service a share, so the footer keeps only Copy.
        await open(page, sharingUrl({ returnScheme: undefined }));
        await settle(page);

        expect(await page.evaluate(() => typeof navigator.share)).toBe(
            "undefined"
        );
        await expect(page.locator("footer button")).toHaveCount(1);
        await expect(
            page.getByRole("button", { name: /copier|copy/i })
        ).toBeVisible();

        await shoot(page, "sharing-no-return-scheme.png");
    });

    test("reports an error when the host sent no clientId", async ({
        page,
    }) => {
        const results = recordHostResults(page);
        await open(page, sharingUrl({ clientId: undefined }));

        // The guard stops the boot and tells the host, so its sheet closes
        // rather than showing an error the user cannot read.
        await expect.poll(() => results.join(" ")).toContain("action=error");
        await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("still renders when the merchant config fails", async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.iphone);
        await page.route("**/*/user/merchant/resolve*", (route) =>
            route.fulfill({ status: 500, body: "{}" })
        );
        await open(page, sharingUrl());
        await settle(page);

        // The link is local, so both CTAs stay usable without the config.
        await expect(page.locator("footer button")).toHaveCount(2);
        await expect(page.locator("footer button").last()).toBeEnabled();

        await shoot(page, "sharing-config-failed.png");
    });

    test("renders while the reward query is still resolving", async ({
        page,
    }) => {
        await page.setViewportSize(VIEWPORTS.iphone);
        // Never fulfilled: holds the reward card in its loading state.
        await page.route("**/*/user/merchant/estimated-rewards*", () => {});
        await open(page, sharingUrl());
        await page.getByRole("dialog").waitFor({ state: "visible" });
        await page
            .locator("footer button")
            .last()
            .waitFor({ state: "visible" });

        await shoot(page, "sharing-reward-loading.png");
    });
});

test.describe("Sharing page — locale", () => {
    // The card tagline, which interpolates the amount, so each locale asserts
    // the other is absent: a French fallback under `lng=en` is the failure.
    const TAGLINE = {
        en: new RegExp(`Earn ${REFERRER_REWARD_EUR}`),
        fr: new RegExp(`Gagnez ${REFERRER_REWARD_EUR}`),
    } as const;

    for (const lng of ["en", "fr"] as const) {
        test(`renders ${lng} when the host asks for it`, async ({ page }) => {
            await page.setViewportSize(VIEWPORTS.iphone);
            // The English bundle is fetched after `languageChanged`; without
            // `bindI18nStore: "added"` this renders the French fallback and
            // never re-renders.
            await open(page, sharingUrl({ lng }));
            await settle(page);

            const other = lng === "en" ? "fr" : "en";
            await expect(page.getByText(TAGLINE[lng])).toBeVisible();
            await expect(page.getByText(TAGLINE[other])).toHaveCount(0);

            await shoot(page, `sharing-locale-${lng}.png`);
        });
    }
});
