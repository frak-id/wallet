import { expect, test } from "./fixtures";

test.beforeEach(async ({ webAuthnHelper }) => {
    await webAuthnHelper.enableVirtualAuthenticator();
    await webAuthnHelper.addAuthenticator();
});

test.afterEach(async ({ webAuthnHelper }) => {
    await webAuthnHelper.clearAuthenticators();
});

test("should redirect to auth page when not logged in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*\/register/);
});

test("auth page should have correct buttons", async ({ page }) => {
    await page.goto("/register");
    await expect(
        page.getByRole("button", { name: /Use QR code to connect/i })
    ).toBeVisible();
    await expect(
        page.getByRole("link", { name: /Use an existing wallet/i })
    ).toBeVisible();
});
