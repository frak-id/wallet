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

// Verify click recovery button
test("should be able to click recovery button ", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickRecoveryButton();
    await settingsPage.verifyRecoverySetupPage();
});

// Verify the activating status toggle
test("Should display activated wallet status", async ({
    settingsPage,
    blockchainHelper,
}) => {
    await blockchainHelper.withEnabledSession();
    await settingsPage.navigateToSettings();
    await settingsPage.verifyDisplayEnableStatus();
});

// Verify the activating status display
test("Should display desactivated wallet status", async ({
    settingsPage,
    blockchainHelper,
}) => {
    await blockchainHelper.withDisabledSession();
    await settingsPage.navigateToSettings();
    await settingsPage.verifyDisplayDisableStatus();
});

// Click the activate wallet button
test("should be able to click activate the wallet button", async ({
    settingsPage,
    blockchainHelper,
    mockedWebAuthN,
}) => {
    await blockchainHelper.withEnabledSession();
    await settingsPage.navigateToSettings();
    await settingsPage.clickActivateWalletButton();

    await mockedWebAuthN.verifySignature();
});

test("should be able to click desactivate wallet button", async ({
    settingsPage,
    blockchainHelper,
    mockedWebAuthN,
}) => {
    await blockchainHelper.withDisabledSession();
    await settingsPage.navigateToSettings();
    await settingsPage.clickDesactivateWalletButton();

    await mockedWebAuthN.verifySignature();
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

test.fail(
    "should display error message on unsubscribe notifications ",
    async ({ settingsPage, backendApi }) => {
        await backendApi.interceptNotificationsRoute((route) =>
            route.fulfill({
                status: 500,
            })
        );
        await settingsPage.navigateToSettings();
        await settingsPage.verifyUnsubscribeNotifications();
        // todo: should add error message
    }
);

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
