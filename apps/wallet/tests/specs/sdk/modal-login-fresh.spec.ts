import { E2E_WALLET_ADDRESS } from "tests/api/backend.api";
import { expect, test } from "tests/fixtures";

/**
 * Logged-out context (chromium-fresh project): exercises the modal `login`
 * step end-to-end — SDK request → listener iframe → WebAuthn ceremony →
 * `/auth/login` → result resolved back to the partner page.
 *
 * Self-contained: WebAuthn is mocked client-side and `/auth/login` is stubbed
 * with a canned session, so it doesn't depend on the global auth setup or the
 * backend's real signature verification.
 */
test.beforeEach(async ({ mockedWebAuthN, backendApi }) => {
    await mockedWebAuthN.setup();
    await backendApi.mockLoginSuccess();
});

test("should log in via passkey from the modal login step", async ({
    sdkHelper,
    modalPage,
}) => {
    await sdkHelper.init();

    // allowSso:false → direct passkey path (avoids the SSO popup)
    await sdkHelper.displayModal({ login: { allowSso: false } });

    await modalPage.verifyModalDisplayed();
    await modalPage.clickLoginPasskey();

    // The modal resolves with the wallet from the (mocked) login response.
    const { result, error } = await sdkHelper.getModalResult();
    expect(error).toBeUndefined();
    const wallet = (result as { login?: { wallet?: string } })?.login?.wallet;
    expect(wallet).toBe(E2E_WALLET_ADDRESS);
});
