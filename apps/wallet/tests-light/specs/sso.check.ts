import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { MERCHANT_ID } from "../mocks/api";

const SDK_SESSION = {
    token: "mock-sdk-jwt-for-light-playwright",
    expires: Date.now() + 86_400_000,
};

function ssoLink(redirectUrl: string) {
    const p = Buffer.from(
        JSON.stringify({
            r: redirectUrl,
            m: MERCHANT_ID,
            md: { n: "Acme Store" },
        })
    ).toString("base64url");
    return `/sso?p=${p}`;
}

/** Answers every navigation to `origin` and records the `sso` handoff it carries. */
async function captureHandoffs(page: Page, origin: string) {
    const handoffs: string[] = [];
    await page.route(`${origin}/**`, (route) => {
        const sso = new URL(route.request().url()).searchParams.get("sso");
        if (sso) handoffs.push(Buffer.from(sso, "base64url").toString());
        return route.fulfill({ contentType: "text/html", body: "<p>ok</p>" });
    });
    return handoffs;
}

/** Passes only on the error screen; on the old page it taps Continue so the leak shows in `handoffs`. */
async function expectRefused(page: Page, handoffs: string[]) {
    const proceed = page.getByRole("button", {
        name: "Continue with my wallet",
    });
    const refused = page.getByRole("heading", { name: "An error occurred" });
    await expect(refused.or(proceed)).toBeVisible();
    if (await proceed.isVisible()) {
        await proceed.click();
        await page.waitForTimeout(3_000);
    }
    expect(handoffs).toEqual([]);
    await expect(refused).toBeVisible();
    await expect(proceed).toBeHidden();
}

test.beforeEach(async ({ page }) => {
    await page.route("**/*/user/wallet/auth/sdk/generate*", (route) =>
        route.fulfill({ json: SDK_SESSION })
    );
});

test.describe("SSO redirect", () => {
    test("hands the session to the merchant's own domain", async ({ page }) => {
        const handoffs = await captureHandoffs(
            page,
            "https://acme.example.com"
        );
        await page.goto(ssoLink("https://acme.example.com/return"));
        await page
            .getByRole("button", { name: "Continue with my wallet" })
            .click();
        await expect.poll(() => handoffs.length, { timeout: 6_000 }).toBe(1);
        expect(handoffs[0]).toContain(SDK_SESSION.token);
    });

    test("never hands the session to a domain the merchant does not own", async ({
        page,
    }) => {
        const handoffs = await captureHandoffs(
            page,
            "https://attacker.example"
        );
        await page.goto(ssoLink("https://attacker.example/collect"));
        await expectRefused(page, handoffs);
    });

    test("refuses a redirect when the merchant cannot be resolved", async ({
        page,
    }) => {
        await page.route("**/*/user/merchant/resolve*", (route) =>
            route.fulfill({ status: 404, body: "Merchant not found" })
        );
        const handoffs = await captureHandoffs(
            page,
            "https://acme.example.com"
        );
        await page.goto(ssoLink("https://acme.example.com/return"));
        await expectRefused(page, handoffs);
    });
});
