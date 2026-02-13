import { test } from "../../fixtures";

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

// Verify display the settings page
test("should display settings page", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyLogoutButton();
});
