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

    // Register wallet with biometrics (navigates onboarding slides + Keypass)
    await authPage.clickRegister();

    // Dismiss onboarding and land on the wallet.
    await authPage.completeOnboarding();

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
    await webAuthN.setUserVerified(false);

    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();
    await authPage.clickRegister();

    // Registration must not succeed.
    await authPage.verifyRegistrationError();
    await expect(page).toHaveURL(/\/register/);
});

// Scope the stub to /register so the emailStatus check still passes.
test("should handle backend error during registration", async ({
    page,
    backendApi,
    authPage,
}) => {
    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();

    // Backend register call fails.
    await backendApi.interceptRegisterRoute((route) =>
        route.fulfill({ status: 500 })
    );

    await authPage.clickRegister();

    // Error toast is shown and we stay on the registration flow.
    await authPage.verifyRegistrationError();
    await expect(page).toHaveURL(/\/register/);
});

test("should handle network issue during registration", async ({
    page,
    backendApi,
    authPage,
}) => {
    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();

    // Register call never completes (network failure).
    await backendApi.interceptRegisterRoute((route) => route.abort());

    await authPage.clickRegister();

    await authPage.verifyRegistrationError();
    await expect(page).toHaveURL(/\/register/);
});

test.fail(
    "should prevent duplicate backend wallet registration",
    async ({ page, authPage, mockedWebAuthN }) => {
        await mockedWebAuthN.setup();

        // Attempt second registration with same authenticator
        await authPage.navigateToRegister();
        await authPage.verifyRegistrationReady();
        await authPage.clickRegister();

        // Should show error about existing wallet
        // todo: need to wait for it, how? wait for loading butrton to not be visible?
        await authPage.verifyRegistrationError();
        await expect(page).toHaveURL("/register");
    }
);

// todo: test duplicate wallet registration local error using cdp webauthn
