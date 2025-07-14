import { test } from "../../fixtures";

//verify the settings button click and display the settings page
test("should display settings page when settings button clicked", async ({
    settingsPage,
}) => {
    await settingsPage.navigateToSettings();
});
