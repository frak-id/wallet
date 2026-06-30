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

// Verify copy and share buttons are enabled
test("should display enabled copy and share buttons", async ({
    sdkHelper,
    modalPage,
}) => {
    await sdkHelper.init();

    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();
    await modalPage.verifyEnableCopyAndShareButton();
});

// Click copy button
test("should be able to click the copy button", async ({
    sdkHelper,
    modalPage,
    clipboardHelper,
}) => {
    await sdkHelper.init();

    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();
    await modalPage.clickCopyButton();
    await clipboardHelper.verifyClipboardNotEmpty();
});

// Click share button
test("should be able to click the share button", async ({
    sdkHelper,
    modalPage,
}) => {
    await sdkHelper.init();

    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();
    await modalPage.clickShareButton();
});

// The partner page pins the modal to French (example/vanilla-js sets
// config.metadata.lang="fr"), so the share title/text are localized and not
// controllable from the test. Assert the locale-independent payload shape.
test("should call navigator.share with the sharing link", async ({
    sdkHelper,
    modalPage,
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

    await sdkHelper.init();
    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();
    await modalPage.verifyEnableCopyAndShareButton();
    await modalPage.clickShareButton();

    expect(capturedShareData).toBeDefined();
    expect(capturedShareData?.title).toBeTruthy();
    expect(capturedShareData?.text).toBeTruthy();
    // Host/locale-independent: assert the Frak attribution context is present
    // (arrives as fCtx, sometimes lowercased in transit).
    expect(capturedShareData?.url).toMatch(/^https?:\/\//);
    expect(capturedShareData?.url).toMatch(/[?&]fctx=/i);
});
