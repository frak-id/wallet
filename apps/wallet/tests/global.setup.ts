import { STORAGE_STATE } from "../playwright.config";
import { test } from "./fixtures";

/**
 * Setup the wallet (especially the storage) for the global tests
 *  - The authenticator isn't backed up by the storage state, so we need to
 *    create a new one for each test.
 */
test("Authentication setup", async ({ page }) => {
    // todo: We should use a mocked webauthn helper
    // // Register a new wallet
    // await authPage.navigateToRegister();
    // await authPage.verifyRegistrationReady();

    // // Register wallet with biometrics
    // await authPage.clickRegister();

    // // Ensure the user got redirected to the wallet page
    // await authPage.verifyWalletPage();

    // // Verify credentials were created in virtual authenticator
    // const credentials = await webAuthN.getCredentials();
    // expect(credentials).toHaveLength(1);

    // Save the state in storage
    await page.context().storageState({ path: STORAGE_STATE });
});
