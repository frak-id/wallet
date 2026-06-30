import { test } from "tests/fixtures";

// Should display the balance
test("should display the modal balance", async ({
    sdkHelper,
    modalPage,
    backendApi,
}) => {
    await backendApi.interceptBalanceRoute((route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                total: {
                    amount: 420,
                    eurAmount: 420,
                    usdAmount: 420,
                    gbpAmount: 420,
                },
                balances: [],
            }),
        })
    );

    await sdkHelper.init();
    await sdkHelper.openWalletModal();
    await modalPage.verifyBalanceInformations(420);
});

test.fail(
    "should handle balance error",
    async ({ sdkHelper, backendApi, modalPage }) => {
        // Mock the  balance information
        await backendApi.interceptBalanceRoute((route) =>
            route.fulfill({
                status: 500,
            })
        );
        await sdkHelper.init();
        await sdkHelper.openWalletModal();
        await modalPage.verifyBalanceInformations(1);
        // todo: should add error message
    }
);
