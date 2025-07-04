import { expect, test } from "../../fixtures";

// No storage state needed for the registration related tests
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ mockedWebAuthN, webAuthN }) => {
    await mockedWebAuthN.setup();
    // await webAuthN.setup();
});

test.only("should login existing wallet with biometrics successfully", async ({
    authPage,
    settingsPage,
    analyticsApi,
}) => {
    // First register a wallet
    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();
    await authPage.clickRegister();
    await authPage.verifyWalletPage();

    // Clear session to simulate returning user
    await settingsPage.navigateToSettings();
    await settingsPage.clickLogout();

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

// todo: we don't catch login errors at all
test.fail(
    "should handle WebAuthn authentication failure",
    async ({ webAuthN, authPage, settingsPage }) => {
        // First register a wallet
        await authPage.navigateToRegister();
        await authPage.verifyRegistrationReady();
        await authPage.clickRegister();
        await authPage.verifyWalletPage();

        // Clear session to simulate returning user
        await settingsPage.navigateToSettings();
        await settingsPage.clickLogout();

        // Modify authenticator to fail verification
        await webAuthN.setUserVerified(false);

        // Attempt login
        await authPage.navigateToLogin();
        await authPage.verifyLoginReady();
        await authPage.clickLogin();

        // Should show WebAuthn failure error
        await authPage.verifyLoginError();
    }
);

test("should handle network issues during login", async ({
    settingsPage,
    authPage,
    backendApi,
}) => {
    // Register wallet first
    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();
    await authPage.clickRegister();
    await authPage.verifyWalletPage();

    // Clear session
    await settingsPage.navigateToSettings();
    await settingsPage.clickLogout();

    // Simulate network failure for login
    await backendApi.interceptAuthRoute((route) =>
        route.fulfill({
            status: 500,
        })
    );

    await authPage.navigateToLogin();
    await authPage.verifyLoginReady();
    await authPage.clickLogin();

    // Should show network error
    await authPage.verifyLoginError();
});
