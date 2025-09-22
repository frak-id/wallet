/**
 *  Verify the enable and disable session with the pairingTab.hepers
 *
 */

import { test } from "tests/fixtures";

// Verify the enable session with the pairingTabHelper
test("should be able to enable the session when disabled", async ({
    pairingTab,
    blockchainHelper,
    sdkHelper,
    modalPage,
}) => {
    await blockchainHelper.withEnabledSession();
    await sdkHelper.init();

    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();

    await modalPage.verifyEnableCopyAndShareButton();

    await modalPage.clickDesactivatedButton();

    await pairingTab.rejectSignatureRequest();
});

// Verify the disable session with the pairingTabHelper
test("should be able to disable the session when activated", async ({
    pairingTab,
    blockchainHelper,
    sdkHelper,
    modalPage,
}) => {
    await blockchainHelper.withDisabledSession();
    await sdkHelper.init();
    await sdkHelper.openWalletModal();
    await modalPage.verifyModalDisplayed();
    await modalPage.verifyDisableCopyAndShareButton();
    await modalPage.clickActivatedButton();
    await pairingTab.acceptSignatureRequest();
});
