import { STORAGE_STATE } from "../playwright.config";
import { test } from "./fixtures";

/**
 * Setup the wallet for the global tests
 *  - If mocked webauthn not registered yet, register it
 *  - Otherwise, do a login to ensure the wallet is registered
 */
test("Register mocked webauthn", async ({ page, mockedWebAuthN, authPage }) => {
    await mockedWebAuthN.setup();

    // Register a new wallet
    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();

    // Startup the registration
    await authPage.clickRegister();

    // Wait 2sec for a potential url change page
    try {
        await page.waitForURL("/wallet", {
            timeout: 2_000,
            waitUntil: "networkidle",
        });
    } catch (_e) {
        console.log("No wallet page, skipping registration");
    }

    // Check if we got an error on the registration button
    const hasFailureButton = await page
        .locator("button", {
            hasText: "Error during registration, please try again",
        })
        .isVisible({ timeout: 2_000 });

    // If all good, just save the storage and exit
    if (!hasFailureButton) {
        console.log("No failure button, skipping registration");
        // Save the state in storage
        await page.context().storageState({ path: STORAGE_STATE });
        return;
    }

    // Register wallet with biometrics
    await authPage.navigateToLogin();
    await authPage.verifyLoginReady();
    await authPage.clickLogin();

    // Ensure we are on the wallet page
    await authPage.verifyWalletPage();

    // Save the state in storage
    await page.context().storageState({ path: STORAGE_STATE });
});
