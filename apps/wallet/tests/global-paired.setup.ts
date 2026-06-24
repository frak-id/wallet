import { PAIRED_STORAGE_STATE } from "../playwright.config";
import { test } from "./fixtures";

/**
 * Produce the paired (distant-webauthn) storage state.
 *
 * Split out from the on-device setup so its (more fragile) cross-device
 * pairing flow can't block the on-device suite — only the `chromium-paired`
 * project depends on it.
 */
test("Log with paired wallet", async ({ page, pairingTab, authPage }) => {
    // Cross-device pairing + full onboarding is heavy locally — give it room.
    test.setTimeout(150_000);

    await pairingTab.setup();

    // Go to registration and advance to Keypass step (where QR code button is)
    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();
    await authPage.navigateToKeypass();

    // Startup a pairing flow
    await authPage.clickPairing();
    await authPage.verifyPairingReady();

    // Read the pairing id + code from the page. The pairing socket isn't
    // observable from Playwright, so we read the values the UI exposes rather
    // than intercepting the WebSocket.
    const { pairingId, pairingCode } = await authPage.getPairingInfo();

    // Confirm pairing in the pairing tab
    await pairingTab.confirmPairing(pairingId, pairingCode);

    // After pairing, the origin continues onboarding (referral → notification
    // → welcome) before landing on the wallet — same as the on-device flow.
    await authPage.skipReferralIfPresent();
    await authPage.skipNotificationIfPresent();
    await authPage.verifyWelcomeScreen();
    await authPage.clickContinueOnWelcome();

    // Ensure that the wallet is authenticated
    await authPage.verifyWalletPage();

    // Save the state in storage
    await page.context().storageState({ path: PAIRED_STORAGE_STATE });
});
