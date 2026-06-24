import { test } from "../../fixtures";

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

// Logout was removed; assert the identity card instead.
test("should display settings page", async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.verifyProfileIdentity();
});
