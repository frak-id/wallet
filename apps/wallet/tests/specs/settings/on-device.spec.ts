import { test } from "../../fixtures";

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

//verify display the settings page
test("should display settings", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
});

// verify the "wallet:" button is visible
test("wallet button visible", async ({ settingsPage }) => {
    // Navigate to the settings page
    await settingsPage.navigateToSettings();
    // Verify that the "wallet:" button is visible
    await settingsPage.verifyWalletButton();
});

//verify logout button visible
test("logout  button is visble ", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyLogoutButton();
});

//verify the setting button is visible
test("setting button visible", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.SettingsButton();
});

//verify biometry block is viisble
test("should display biometry informations", async ({ settingsPage }) => {
      // Navigate to the settings page
    await settingsPage.navigateToSettings();
    await settingsPage.verifyBiometryInformation();
});

// verify the authenticator button is visible
test("authenticator button visible", async ({ settingsPage }) => {
    // Navigate to the settings page
    await settingsPage.navigateToSettings();
    // Verify that the authenticator button is visible
    await settingsPage.verifyAuthenticatorButton();
});

// verify copy authenticator information in clipboard
test("should copy authenticator information", async ({
    settingsPage,
    clipboardHelper,
}) => {
    // Navigate to the settings page
    await settingsPage.navigateToSettings();
    // Copy authenticator information
    await settingsPage.copyAuthenticatorInformations();
    // Verify that the clipboard is not empty
    await clipboardHelper.verifyClipboardNotEmpty();
});

//verify click recovery button
test("should click recovery button", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickRecoveryButton();
});

//verify the activate wallet button
// todo: mock the activation / deactivation of the wallet
test.skip("click activate wallet button", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickActivateWalletButton();
});

//verify the desactivate wallet button
// todo: mock the activation / deactivation of the wallet
test.skip("click desactivate wallet button", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickDesactivateWalletButton();
    // need to be locked at the wallet to verify the desactivate wallet button
});

//verify the notification  button is visible
test("notification  button is visble ", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyNotificationsButton();
});

//verify the notifcation button click and notifications page
test("notification  button click ", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyNotificationsButtonClick();
});

//verify the unsubscribe notifications
test.skip("unsubscribe notifications block", async ({ settingsPage }) => {
    await settingsPage.verifyUnsubscribeNotifications();
});

//verify settings button click
test("setting button click", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickSettingsButton();
});
