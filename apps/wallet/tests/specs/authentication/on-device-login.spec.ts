import { expect, test } from "../../fixtures";

// No storage state needed for the registration related tests
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

test("should login existing wallet with biometrics successfully", async ({
    authPage,
    analyticsApi,
}) => {
    let analyticsRequestsCount = 0;
    await analyticsApi.interceptAnalyticsRoute((route) => {
        analyticsRequestsCount++;
        route.continue();
    });

    // Now test login
    await authPage.navigateToLogin();
    await authPage.verifyLoginReady();
    await authPage.clickLogin();

    // Verify successful login
    await authPage.verifyWalletPage();

    // Ensure that we have at least one analytics request
    expect(analyticsRequestsCount).toBeGreaterThan(0);
});

// todo: pass that to the mocked webauthn helper
test.fail(
    "should handle WebAuthn authentication failure",
    async ({ authPage }) => {
        // Attempt login
        await authPage.navigateToLogin();
        await authPage.verifyLoginReady();
        await authPage.clickLogin();

        // Should show WebAuthn failure error
        await authPage.verifyLoginError();
    }
);

// todo: we don't catch nor display login errors
test.fail(
    "should handle network issues during login",
    async ({ authPage, backendApi, page }) => {
        // Simulate network failure for login
        await backendApi.interceptAuthRoute((route) =>
            route.fulfill({
                status: 500,
            })
        );

        await authPage.navigateToLogin();
        await authPage.verifyLoginReady();
        await authPage.clickLogin();

        await page.waitForTimeout(2_000);

        // Should show network error
        await authPage.verifyLoginError();
    }
);
