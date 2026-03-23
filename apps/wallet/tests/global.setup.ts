import {
    ON_DEVICE_STORAGE_STATE,
    PAIRED_STORAGE_STATE,
} from "../playwright.config";
import { test } from "./fixtures";

/**
 * Setup the wallet for the global tests
 *  - If mocked webauthn not registered yet, register it
 *  - Otherwise, do a login to ensure the wallet is registered
 */
test("Log with mocked webauthn", async ({ page, mockedWebAuthN, authPage }) => {
    await mockedWebAuthN.setup();

    // First try a login
    await authPage.navigateToLogin();
    await authPage.verifyLoginReady();
    await authPage.clickLogin();

    // Wait 2sec for a potential url change page
    try {
        await page.waitForURL("/wallet", {
            timeout: 2_000,
            waitUntil: "networkidle",
        });
        await page.context().storageState({ path: ON_DEVICE_STORAGE_STATE });
        return;
    } catch (_e) {
        console.log(
            "[Setup] Not on wallet page, will register new authenticator"
        );
    }

    // Register a new wallet
    await authPage.navigateToRegister();
    await authPage.verifyRegistrationReady();
    await authPage.clickRegister();

    // Ensure we land onthe wallet page
    await authPage.verifyWalletPage();

    // Save the state in storage
    await page.context().storageState({ path: ON_DEVICE_STORAGE_STATE });
});

/**
 * Setup the wallet for the global tests
 *  - If mocked webauthn not registered yet, register it
 *  - Otherwise, do a login to ensure the wallet is registered
 */
test("Log with paired wallet", async ({
    page,
    pairingTab,
    authPage,
    backendApi,
}) => {
    await pairingTab.setup();

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

    // Save the state in storage
    await page.context().storageState({ path: PAIRED_STORAGE_STATE });
});
