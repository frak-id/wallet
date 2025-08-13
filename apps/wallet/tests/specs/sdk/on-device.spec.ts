import { test } from "tests/fixtures";

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

// Verify  buttons status after click the activate button
test("should be able to activate the session when disabled", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
    mockedWebAuthN,
}) => {
    await blockchainHelper.withDisabledSession();
    await sdkHelper.init();

    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();

    await modalPage.verifyDisableCopyAndShareButton();

    await modalPage.clickActivatedButton();

    await mockedWebAuthN.verifySignature(modalPage.frame);
});

// Verify buttons status after click the desactivate button
test("should be able to desactive the session when activated", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
    mockedWebAuthN,
}) => {
    await blockchainHelper.withEnabledSession();
    await sdkHelper.init();

    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();

    await modalPage.verifyEnableCopyAndShareButton();

    await modalPage.clickDesactivatedButton();

    await mockedWebAuthN.verifySignature(modalPage.frame);
});
