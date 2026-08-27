import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { RETURN_SCHEME, recordHostResults } from "../mocks/nativeHost";

/**
 * Visual checks for the standalone `/install` page.
 *
 * This is where the native SDK hands over the install code: the sheet loads it
 * in the same web view as `/sharing`, and the code comes back over the return
 * channel as `action=code`. A logged-out web visitor gets the same screen.
 */

const VIEWPORTS = {
    iphone: { width: 390, height: 844 },
    /** The tablet case: a host sheet is full-bleed at every width. */
    ipad: { width: 768, height: 1024 },
} as const;

const INSTALL_CODE = "LOLA10";

/** Mirrors the `/install` URL the SDK builds after an install tap. */
function installUrl(overrides: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams({
        m: "0x1234",
        a: "anon-abc",
        embed: "native",
        returnScheme: RETURN_SCHEME,
        sid: "s1",
    });
    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) params.delete(key);
        else params.set(key, value);
    }
    return `/install?${params}`;
}
/** The page mints a code from the credential the host forwarded. */
async function mockInstallCode(page: Page, code: string | null = INSTALL_CODE) {
    await page.route("**/*/user/identity/install-code/generate", (route) =>
        route.fulfill({
            // A refused credential is terminal and renders the store link; a
            // 5xx would retry instead.
            status: code ? 200 : 403,
            contentType: "application/json",
            body: JSON.stringify(
                code
                    ? {
                          code,
                          expiresAt: new Date(
                              Date.now() + 72 * 3_600_000
                          ).toISOString(),
                      }
                    : { error: "no credential" }
            ),
        })
    );
}

// `getSafeSession()?.token` is what routes a web visit to the processing
// screen; the install-code screen is the logged-out branch.
async function openLoggedOut(page: Page, url: string, injectAuthState: Inject) {
    await injectAuthState({ authenticated: false });
    await page.goto(url, { waitUntil: "commit" });
}

type Inject = (options?: { authenticated?: boolean }) => Promise<void>;

async function settle(page: Page) {
    await page.getByText(INSTALL_CODE).waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
}

async function shoot(page: Page, name: string) {
    await expect(page).toHaveScreenshot(name, { animations: "disabled" });
}

test.describe("Install page — native sheet", () => {
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
        test(`renders chromeless at ${name}`, async ({
            page,
            injectAuthState,
        }) => {
            await page.setViewportSize(viewport);
            await mockInstallCode(page);
            await openLoggedOut(page, installUrl(), injectAuthState);
            await settle(page);

            await shoot(page, `install-native-${name}.png`);
        });
    }

    test("fills the viewport with no card treatment", async ({
        page,
        injectAuthState,
    }) => {
        await page.setViewportSize(VIEWPORTS.ipad);
        await mockInstallCode(page);
        await openLoggedOut(page, installUrl(), injectAuthState);
        await settle(page);

        // The regression this page shipped with: `body` centres its children at
        // tablet widths, leaving a host's full-bleed sheet showing its scrim
        // down both edges.
        const width = await page
            .locator("main")
            .evaluate((el) => el.getBoundingClientRect().width);
        expect(Math.round(width)).toBe(VIEWPORTS.ipad.width);
    });

    test("tags the document so the stylesheet drops its centering", async ({
        page,
        injectAuthState,
    }) => {
        await mockInstallCode(page);
        await openLoggedOut(page, installUrl(), injectAuthState);
        await settle(page);

        await expect(page.locator("html")).toHaveAttribute(
            "data-embed",
            "native"
        );
    });

    test("hides its own header when a host draws the chrome", async ({
        page,
        injectAuthState,
    }) => {
        await mockInstallCode(page);
        await openLoggedOut(page, installUrl(), injectAuthState);
        await settle(page);

        // The page's close button calls `window.close()`, which a web view
        // ignores — so it must not be reachable inside a sheet.
        await expect(page.locator("header")).toHaveCount(0);
    });

    test("keeps its header on a plain web visit", async ({
        page,
        injectAuthState,
    }) => {
        await page.setViewportSize(VIEWPORTS.iphone);
        await mockInstallCode(page);
        await openLoggedOut(
            page,
            installUrl({ embed: undefined, returnScheme: undefined }),
            injectAuthState
        );
        await settle(page);

        await expect(page.locator("header")).toHaveCount(1);
        await shoot(page, "install-web-iphone.png");
    });
});

test.describe("Install page — host bridge", () => {
    test("hands the code over on copy", async ({ page, injectAuthState }) => {
        const results = recordHostResults(page);
        await mockInstallCode(page);
        await openLoggedOut(page, installUrl(), injectAuthState);
        await settle(page);

        await page
            .getByRole("button", { name: /copier|copy/i })
            .first()
            .click();

        // The host rewrites the pasteboard entry with an expiry and
        // `localOnly`, neither of which this page can set.
        await expect
            .poll(() => results.join(" "))
            .toContain(`action=code&sid=s1&value=${INSTALL_CODE}`);
        await expect.poll(() => results.join(" ")).toContain("exp=");
    });

    test("sends nothing without a return scheme", async ({
        page,
        injectAuthState,
    }) => {
        const results = recordHostResults(page);
        await mockInstallCode(page);
        await openLoggedOut(
            page,
            installUrl({ returnScheme: undefined }),
            injectAuthState
        );
        await settle(page);

        await page
            .getByRole("button", { name: /copier|copy/i })
            .first()
            .click();
        await page.waitForTimeout(500);

        expect(results).toHaveLength(0);
    });
});

test.describe("Install page — degraded", () => {
    test("renders the store link when no code can be minted", async ({
        page,
        injectAuthState,
    }) => {
        await page.setViewportSize(VIEWPORTS.iphone);
        await mockInstallCode(page, null);
        await openLoggedOut(page, installUrl(), injectAuthState);

        // Codeless must never render as an error, nor as a "copy this code"
        // hero with no code beneath it: the store link is the whole surface.
        await expect(page.locator("footer a")).toBeVisible();
        await expect(page.getByText(INSTALL_CODE)).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);

        await shoot(page, "install-codeless.png");
    });

    test("stays codeless when the host forwarded no credential", async ({
        page,
        injectAuthState,
    }) => {
        await page.setViewportSize(VIEWPORTS.iphone);
        await mockInstallCode(page);
        await openLoggedOut(
            page,
            installUrl({ a: undefined }),
            injectAuthState
        );

        // No anonymous id and no checkout token: nothing to mint from, so the
        // page must not even ask.
        await expect(page.locator("footer a")).toBeVisible();
        await expect(page.getByText(INSTALL_CODE)).toHaveCount(0);
    });
});
