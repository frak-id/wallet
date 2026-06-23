import { E2E_WALLET_ADDRESS } from "tests/api/backend.api";
import { expect, test } from "tests/fixtures";

/**
 * Logged-out context (chromium-fresh): the modal's resolve/dismiss + emit
 * logic, end-to-end. Self-contained via mocked WebAuthn + `/auth/login`, so no
 * dependency on the global auth setup.
 */
test.beforeEach(async ({ mockedWebAuthN, backendApi }) => {
    await mockedWebAuthN.setup();
    await backendApi.mockLoginSuccess();
});

test("rejects with clientAborted when the modal is closed mid-flow", async ({
    sdkHelper,
    modalPage,
}) => {
    await sdkHelper.init();
    await sdkHelper.displayModal({ login: { allowSso: false } });

    await modalPage.verifyModalDisplayed();
    await modalPage.clickClose();

    const { result, error } = await sdkHelper.getModalResult();
    expect(result).toBeUndefined();
    expect(error).toBeDefined();
});

test("resolves with results after dismissing the reward final step", async ({
    sdkHelper,
    modalPage,
}) => {
    await sdkHelper.init();
    await sdkHelper.displayModal({
        login: { allowSso: false },
        final: { action: { key: "reward" } },
    });

    await modalPage.verifyModalDisplayed();
    // login step → passkey → mocked login → advances to final reward
    await modalPage.clickLoginPasskey();
    await modalPage.waitForLoginToAdvance();
    await modalPage.clickPrimary();

    const { result, error } = await sdkHelper.getModalResult();
    expect(error).toBeUndefined();
    const wallet = (result as { login?: { wallet?: string } })?.login?.wallet;
    expect(wallet).toBe(E2E_WALLET_ADDRESS);
});
