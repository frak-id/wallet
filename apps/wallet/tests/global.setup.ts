import { STORAGE_STATE } from "../playwright.config";
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

    // Wait 2sec for a potential url change page
    try {
        await page.waitForURL("/wallet", {
            timeout: 2_000,
            waitUntil: "networkidle",
        });
        await page.context().storageState({ path: STORAGE_STATE });
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

    // Ensure we land onthe wallet page
    await authPage.verifyWalletPage();

    // Save the state in storage
    await page.context().storageState({ path: STORAGE_STATE });
});
