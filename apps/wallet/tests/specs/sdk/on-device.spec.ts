import { test } from "tests/fixtures";

test.beforeEach(async ({ sdkHelper }) => {
    await sdkHelper.init();
});

test("should open embeded wallet on js trigger", async ({
    sdkHelper,
    modalPage,
    page,
}) => {
    // Ensure that the modal isn't displayed at first
    await modalPage.verifyModalNotDisplayed();

    // Trigger the display modal openning
    await sdkHelper.openWalletModal();

    // Verify that the modal is displayed
    await modalPage.verifyModalDisplayed();

    // Click anywhere on the page, outstide of the wallet
    await page.click("body");

    // Verify that the modal is displayed
    await modalPage.verifyModalNotDisplayed();
});
