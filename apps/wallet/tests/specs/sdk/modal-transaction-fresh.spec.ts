import { test } from "tests/fixtures";

/**
 * Logged-out context (chromium-fresh): the modal advances from the login step
 * to the sendTransaction step. Self-contained via mocked WebAuthn + `/auth/login`.
 *
 * Scope is the listener's step navigation. The actual userOp signing/bundler
 * path is out of scope here (needs a real smart wallet) and is covered by the
 * listener unit tests.
 */
test.beforeEach(async ({ mockedWebAuthN, backendApi }) => {
    await mockedWebAuthN.setup();
    await backendApi.mockLoginSuccess();
});

test("navigates to the sendTransaction step after login", async ({
    sdkHelper,
    modalPage,
}) => {
    await sdkHelper.init();
    await sdkHelper.displayModal({
        login: { allowSso: false },
        sendTransaction: {
            tx: {
                to: "0x0000000000000000000000000000000000000000",
                data: "0x",
            },
        },
    });

    await modalPage.verifyModalDisplayed();
    await modalPage.clickLoginPasskey();
    await modalPage.waitForLoginToAdvance();
    await modalPage.verifyTransactionStep();
});
