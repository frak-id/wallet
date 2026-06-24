import { test } from "tests/fixtures";

// No storage state needed for the registration related tests
test.use({ storageState: { cookies: [], origins: [] } });

test("Should be able to pair from desktop to mobile", async ({
    authPage,
    pairingTab,
}) => {
    // Go to registration and advance to Keypass step (where QR code button is)
    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();
    await authPage.navigateToKeypass();

    // Startup a pairing flow
    await authPage.clickPairing();
    await authPage.verifyPairingReady();

    // Read pairing id + code from the DOM (the WS interceptor no longer
    // captures them) — same path the paired setup uses.
    const { pairingId, pairingCode } = await authPage.getPairingInfo();

    // Confirm pairing in the pairing tab
    await pairingTab.confirmPairing(pairingId, pairingCode);

    // After pairing, finish onboarding (referral → notification → welcome).
    await authPage.skipReferralIfPresent();
    await authPage.skipNotificationIfPresent();
    await authPage.verifyWelcomeScreen();
    await authPage.clickContinueOnWelcome();

    // Ensure that the wallet is authenticated
    await authPage.verifyWalletPage();
});
