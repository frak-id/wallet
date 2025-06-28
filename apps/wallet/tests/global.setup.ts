import { STORAGE_STATE } from "../playwright.config";
import { expect, test } from "./fixtures";

test("Authentication setup", async ({ page, webAuthN, authPage }) => {
    // Register a new wallet
    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();

    // Register wallet with biometrics
    await authPage.clickRegister();

    // Ensure the user got redirected to the wallet page
    await authPage.verifyWalletPage();

    // Verify credentials were created in virtual authenticator
    const credentials = await webAuthN.getCredentials();
    expect(credentials).toHaveLength(1);

    // Save the state in storage
    await page.context().storageState({ path: STORAGE_STATE });
});
