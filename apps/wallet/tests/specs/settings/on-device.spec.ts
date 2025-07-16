import { test } from "../../fixtures";

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

//verify display the settings page
test("should display settings", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyDisplaySettingsPage();
});

//verify click recovery button
test("should click recovery button", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyDisplaySettingsPage();

    await settingsPage.clickRecoveryButton();
});

//verify the activate wallet button
// todo: mock the activation / deactivation of the wallet
test.skip("click activate wallet button", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyDisplaySettingsPage();
    await settingsPage.clickActivateWalletButton();
});

//verify the desactivate wallet button
// todo: mock the activation / deactivation of the wallet
test.skip("click desactivate wallet button", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyDisplaySettingsPage();
    await settingsPage.clickDesactivateWalletButton();
    // need to be locked at the wallet to verify the desactivate wallet button
});

// verify the authenticator button is visible
test("authenticator button visible", async ({ settingsPage }) => {
    // Navigate to the settings page
    await settingsPage.navigateToSettings();
    // Verify that the history page is displayed with rewards and interactions
    await settingsPage.verifyDisplaySettingsPage();
    // Verify that the authenticator button is visible
    await settingsPage.authenticatorButtonVisible();
});
//verify copy authenticator information in clipboard
test("should copy authenticator information", async ({
    settingsPage,
    clipboardHelper,
}) => {
    // Navigate to the settings page
    await settingsPage.navigateToSettings();
    // Verify that the history page is displayed with rewards and interactions
    await settingsPage.verifyDisplaySettingsPage();
    // Copy authenticator information
    await settingsPage.copyAuthenticatorInformations();
    // Verify that the clipboard is not empty
    await clipboardHelper.verifyClipboardNotEmpty();
});
