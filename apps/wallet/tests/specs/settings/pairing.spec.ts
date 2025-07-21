import { test } from "../../fixtures";

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

//verify display the settings page
test("should display settings page", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyLogoutButton();
});


//verify the activate wallet button
// todo: mock the activation / deactivation of the wallet
test.skip("should be able to click activate the wallet button", async ({
    settingsPage,
}) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickActivateWalletButton();
});

//verify the desactivate wallet button
// todo: mock the activation / deactivation of the wallet
test.skip("should be able to click desactivate wallet button", async ({
    settingsPage,
}) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickDesactivateWalletButton();
    // need to be locked at the wallet to verify the desactivate wallet button
});