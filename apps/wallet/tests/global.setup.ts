import { ON_DEVICE_STORAGE_STATE } from "../playwright.config";
import { test } from "./fixtures";

/**
 * Setup the wallet for the global tests
 *  - If mocked webauthn not registered yet, register it
 *  - Otherwise, do a login to ensure the wallet is registered
 */
test("Log with mocked webauthn", async ({ page, mockedWebAuthN, authPage }) => {
    await mockedWebAuthN.setup();

    // First try a login
    await authPage.navigateToLogin();
    await authPage.verifyLoginReady();
    await authPage.clickLogin();

    // Wait for a potential url change to the wallet (login success). Give the
    // WebAuthn ceremony + backend round-trip enough time on remote envs before
    // falling back to registration.
    try {
        // Detect login success by the URL change only. `networkidle` never
        // settles on /wallet (live sockets + balance polling), which would
        // make the probe miss a successful login and fall into registration.
        await page.waitForURL("/wallet", { timeout: 10_000 });
        await page.context().storageState({ path: ON_DEVICE_STORAGE_STATE });
        return;
    } catch (_e) {
        console.log(
            "[Setup] Not on wallet page, will register new authenticator"
        );
    }

    // Register a new wallet
    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();
    await authPage.clickRegister();

    // Post-registration onboarding steps (each skipped if auto-advanced)
    await authPage.skipReferralIfPresent();
    await authPage.skipNotificationIfPresent();

    // Welcome screen
    await authPage.verifyWelcomeScreen();
    await authPage.clickContinueOnWelcome();

    // Ensure we land on the wallet page
    await authPage.verifyWalletPage();

    // Save the state in storage
    await page.context().storageState({ path: ON_DEVICE_STORAGE_STATE });
});
