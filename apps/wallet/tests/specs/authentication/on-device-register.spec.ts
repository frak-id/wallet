import { expect, test } from "../../fixtures";

// No storage state needed for the registration related tests
test.use({ storageState: { cookies: [], origins: [] } });

test("should register new wallet with biometrics successfully", async ({
    webAuthN,
    authPage,
    analyticsApi,
}) => {
    let analyticsRequestsCount = 0;
    await analyticsApi.interceptAnalyticsRoute((route) => {
        analyticsRequestsCount++;
        route.continue();
    });

    // Navigate to registration page
    await authPage.navigateToRegister();

    // Verify registration page is ready
    await authPage.verifyRegistrationReady();

    // Register wallet with biometrics
    await authPage.clickRegister();

    // Ensure the user got redirected to the wallet page
    await authPage.verifyWalletPage();

    // Verify credentials were created in virtual authenticator
    const credentials = await webAuthN.getCredentials();
    expect(credentials).toHaveLength(1);

    // Ensure that we have at least one analytics request
    expect(analyticsRequestsCount).toBeGreaterThan(0);
});

test("should enforce user verification on WebAuthn registration", async ({
    page,
    webAuthN,
    authPage,
}) => {
    // Set the the user won't be verified
    await webAuthN.setUserVerified(false);

    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();

    // Click register button
    await authPage.clickRegister();

    // Verify that the error is visible and that we are still on the registration page
    await authPage.verifyRegistrationError();
    await expect(page).toHaveURL("/register");

    // Ensure no credentials were created
    const credentials = await webAuthN.getCredentials();
    expect(credentials).toHaveLength(0);
});

// todo: it appear that we don't handle network error very nicely
test.fail(
    "should handle backend error during registration",
    async ({ page, webAuthN, backendApi, authPage }) => {
        await authPage.navigateToRegister();
        await authPage.verifyRegistrationReady();

        // Simulate network failure
        await backendApi.interceptAuthRoute((route) =>
            route.fulfill({
                status: 500,
            })
        );

        await authPage.clickRegister();

        // Should show network error
        await authPage.verifyRegistrationError();
        await expect(page).toHaveURL("/register");

        // Ensure no credentials were created
        const credentials = await webAuthN.getCredentials();
        expect(credentials).toHaveLength(0);
    }
);

// todo: it appear that we don't handle network error very nicely
test.fail(
    "should handle network issue during registration",
    async ({ page, webAuthN, backendApi, authPage }) => {
        await authPage.navigateToRegister();
        await authPage.verifyRegistrationReady();

        // Simulate network failure
        await backendApi.interceptAuthRoute((route) => route.abort());

        await authPage.clickRegister();

        // Should show network error
        await authPage.verifyRegistrationError();
        await expect(page).toHaveURL("/register");

        // Ensure no credentials were created
        const credentials = await webAuthN.getCredentials();
        expect(credentials).toHaveLength(0);
    }
);

// Fcked up, either logout or recreation is fcked up (second registration path with no problem), working in ui mode but not in headless mode
test.fail(
    "should prevent duplicate wallet registration",
    async ({ page, webAuthN, authPage, storageHelper }) => {
        // First registration
        await authPage.navigateToRegister();
        await authPage.clickRegister();
        await authPage.verifyWalletPage();

        // Clear storage
        await storageHelper.clearStorage();

        // Refresh the page
        await page.reload();

        // Verify that we still have only one credential
        let credentials = await webAuthN.getCredentials();
        expect(credentials).toHaveLength(1);

        // Attempt second registration with same authenticator
        await authPage.navigateToRegister();
        await authPage.verifyRegistrationReady();
        await authPage.clickRegister();

        // Verify that we still have only one credential
        credentials = await webAuthN.getCredentials();
        expect(credentials).toHaveLength(1);

        // Should show error about existing wallet
        await authPage.verifyDuplicateWalletError();
        await expect(page).toHaveURL("/register");

        // Verify that we still have only one credential
        credentials = await webAuthN.getCredentials();
        expect(credentials).toHaveLength(1);

        // Wait a bit and ensure that we redirect the user to the login page
        await page.waitForURL("/login", { timeout: 5_000 });
        await expect(page).toHaveURL("/login");
        await authPage.verifyLoginReady();
    }
);
