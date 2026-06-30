import { test } from "../../fixtures";

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

// Profile no longer has Logout or a Recovery-setup section.
test("should display settings page", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyProfileIdentity();
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

// Fresh wallet reaches the setup flow via /profile/recovery (the "Recovery
// options" row only shows once configured).
test("should reach the recovery setup flow", async ({ settingsPage }) => {
    await settingsPage.navigateToRecovery();
    await settingsPage.verifyRecoverySetupPage();
});

// The old "unsubscribe" block is now a Notifications row + toggle.
test("should display the notifications setting", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyNotificationsSetting();
});

//verify navigating to the profile via the bottom tab bar
test("should be able to click setting button", async ({
    page,
    settingsPage,
}) => {
    // Start from the wallet home so the Profil tab is the navigation target.
    await page.goto("/wallet");
    await settingsPage.clickSettingsButton();
    await settingsPage.verifyProfileIdentity();
});
