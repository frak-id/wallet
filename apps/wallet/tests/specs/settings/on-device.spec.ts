import { test } from "../../fixtures";

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

//verify display the settings page
test("should display settings page", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyBiometryInformation();
    await settingsPage.verifyLogoutButton();
    await settingsPage.verifyRecoverySetup();
});

// verify copy authenticator information in clipboard
test("should copy authenticator informations", async ({
    settingsPage,
    clipboardHelper,
}) => {
    // Navigate to the settings page
    await settingsPage.navigateToSettings();
    // Copy authenticator information
    await settingsPage.clickCopyAuthenticatorInformations();
    // Verify that the clipboard is not empty
    await clipboardHelper.verifyClipboardNotEmpty();
});

//verify click recovery button
test("should be able to click recovery button ", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickRecoveryButton();
    await settingsPage.verifyRecoverySetupPage();
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

//verify the unsubscribe notifications block
test("should display unsubscribe notifications block if notifications tokens set", async ({
    backendApi,
    settingsPage,
}) => {
    backendApi.interceptNotificationsRoute((route) =>
        route.fulfill({
            status: 200,
            body: "true",
        })
    );
    await settingsPage.navigateToSettings();
    await settingsPage.verifyUnsubscribeNotifications();
});

//verify the unsubscribe notifications block
test("should not display unsubscribe notifications block if notifications tokens aren't set", async ({
    backendApi,
    settingsPage,
}) => {
    backendApi.interceptNotificationsRoute((route) =>
        route.fulfill({
            status: 200,
            body: "false",
        })
    );
    await settingsPage.navigateToSettings();
    await settingsPage.verifyUnsubscribeNotificationsNotVisible();
});

//verify settings button click
test("should be able to click setting button", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickSettingsButton();
    await settingsPage.verifyBiometryInformation();
});

//verify logout button click
test("should be able to click logout button", async ({
    settingsPage,
    authPage,
}) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickLogoutButton();
    await authPage.verifyRegistrationReady();
});
