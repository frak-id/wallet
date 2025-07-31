import { test } from "tests/fixtures";

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

test("should open embeded wallet on js trigger", async ({
    sdkHelper,
    modalPage,
    page,
}) => {
    await sdkHelper.init();
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

// Verify  buttons status after click the activate button
test("should be able to activate the session when disabled", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
}) => {
    await blockchainHelper.withDisabledSession();
    await sdkHelper.init();

    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();
    await modalPage.verifyDisableCopyAndShareButton();

    await modalPage.clickActivatedButton();

    // todo: quentin add biometry check and mock cleanup
});

// Verify buttons status after click the desactivate button
test("should be able to desactive the session when activated", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
}) => {
    await blockchainHelper.withEnabledSession();
    await sdkHelper.init();

    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();
    await modalPage.verifyEnableCopyAndShareButton();

    await modalPage.clickActivatedButton();

    // todo: quentin add biometry check and mock cleanup
});

// Verify  disabled share and copy buttons with disable session
test("should display disabled copy and share button when disable session", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
}) => {
    await blockchainHelper.withDisabledSession();
    await sdkHelper.init();

    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();
    await modalPage.verifyDisableCopyAndShareButton();
    await modalPage.verifyDeactivatedButton();
});

// Verify  enabled copy and share button with enable session
test("should display enabled copy and share button when enable session", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
}) => {
    await blockchainHelper.withEnabledSession();
    await sdkHelper.init();

    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();
    await modalPage.verifyEnableCopyAndShareButton();
    await modalPage.verifyActivatedButton();
});

// Click share button whith enable session
test("should be able to click the share button", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
}) => {
    await blockchainHelper.withEnabledSession();
    await sdkHelper.init();

    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();
    await modalPage.clickShareButton();

    // todo: Verify that the sharing window api as been called
});

// Click copy button with enable session
test("should be able to click the copy button", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
    clipboardHelper,
}) => {
    await blockchainHelper.withEnabledSession();
    await sdkHelper.init();

    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();
    await modalPage.clickCopyButton();
    await clipboardHelper.verifyClipboardNotEmpty();
});

// Should display the balance
test("should display the modal balance", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
    backendApi,
}) => {
    await backendApi.interceptBalanceRoute((route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                total: {
                    amount: 420,
                    eurAmount: 420,
                    usdAmount: 420,
                    gbpAmount: 420,
                },
                balances: [],
            }),
        })
    );

    await sdkHelper.init();
    await blockchainHelper.withEnabledSession();
    await sdkHelper.openWalletModal();
    await modalPage.verifyBalanceInformations(420);
});

// Verify the balance pending
test("should have the good balance pending", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
    backendApi,
}) => {
    await backendApi.interceptPendingBalanceRoute((route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                amount: 123,
                eurAmount: 123,
                usdAmount: 123,
                gbpAmount: 123,
            }),
        })
    );
    await blockchainHelper.withDisabledSession();
    await sdkHelper.init();
    await sdkHelper.openWalletModal();
    await modalPage.clickActivatedButton();

    await modalPage.verifyPendingInformation(123);
});
