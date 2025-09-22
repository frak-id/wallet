import { expect, test } from "tests/fixtures";

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
    await modalPage.verifyDesactivatedButton();
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
});

// Verify that the sharing window api as been called

test("should call navigator.share with correct data when Share button is clicked", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
    page,
}) => {
    type WindowOverride = typeof window & {
        captureShareData: (data: ShareData) => Promise<void>;
    };
    let capturedShareData: ShareData | undefined;

    await page.exposeFunction("captureShareData", (data: ShareData) => {
        capturedShareData = data;
        return Promise.resolve();
    });

    await page.addInitScript(() => {
        navigator.canShare = () => true;
        navigator.share = (data: ShareData) => {
            return (window as WindowOverride).captureShareData(
                data
            ) as Promise<void>;
        };
    });

    await blockchainHelper.withEnabledSession();
    await sdkHelper.init();
    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();
    await modalPage.verifyEnableCopyAndShareButton();
    await modalPage.clickShareButton();

    expect(capturedShareData).toBeDefined();
    expect(capturedShareData?.title).toBe("e2e test invite link");
    expect(capturedShareData?.text).toContain("Discover this amazing product!");
    expect(capturedShareData?.url).toMatch(/^https?:\/\//);
    expect(capturedShareData?.url).toContain("vanilla.frak-labs.com/");
});
