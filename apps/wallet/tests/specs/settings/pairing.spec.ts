import { test } from "../../fixtures";

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

// Verify display the settings page
test("should display settings page", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyLogoutButton();
});

// Verify the activate wallet button
// Todo: mock the activation / deactivation of the wallet
test.skip("should be able to click activate the wallet button", async ({
    settingsPage,
}) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickActivateWalletButton();
});

// Verify the desactivate wallet button
// Todo: mock the activation / deactivation of the wallet
test.skip("should be able to click desactivate wallet button", async ({
    settingsPage,
}) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickDesactivateWalletButton();
    // need to be locked at the wallet to verify the desactivate wallet button
});
