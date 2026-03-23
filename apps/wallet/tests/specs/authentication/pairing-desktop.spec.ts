import { test } from "tests/fixtures";

// No storage state needed for the registration related tests
test.use({ storageState: { cookies: [], origins: [] } });

test("Should be able to pair from desktop to mobile", async ({
    authPage,
    backendApi,
    pairingTab,
}) => {
    // Setup pairing interceptor
    let pairingId: string | undefined;
    let pairingCode: string | undefined;
    await backendApi.interceptWebsocketAuthMessage({
        onServerMsg: (message) => {
            // Intercept pairing id + code
            const msgPayload = JSON.parse(message as string);
            if (msgPayload.type === "pairing-initiated") {
                pairingId = msgPayload.payload.pairingId;
                pairingCode = msgPayload.payload.pairingCode;
            }
        },
    });

    // Got to registration
    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();

    // Startup a pairing flow
    await authPage.clickPairing();
    await authPage.verifyPairingReady();

    if (!pairingId || !pairingCode) {
        throw new Error("Pairing ID or code is not defined");
    }

    // Confirm pairing in the pairing tab
    await pairingTab.confirmPairing(pairingId, pairingCode);

    // Ensure that the wallet is authenticated
    await authPage.verifyWalletPage();
});
