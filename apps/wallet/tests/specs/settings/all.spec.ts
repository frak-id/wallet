import { test } from "tests/fixtures";

//verify logout button click
test("should be able to click logout button", async ({
    settingsPage,
    authPage,
}) => {
    await settingsPage.navigateToSettings();
    await settingsPage.clickLogoutButton();
    await authPage.verifyRegistrationReady();
});
