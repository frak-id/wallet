import { test } from "tests/fixtures";

// Should display the balance
test("should display the modal balance", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
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

    await blockchainHelper.withEnabledSession();
    await sdkHelper.init();
    await sdkHelper.openWalletModal();
    await modalPage.verifyBalanceInformations(420);
});

// Verify the balance pending
test("should have the good balance pending", async ({
    sdkHelper,
    modalPage,
    blockchainHelper,
    backendApi,
}) => {
    await backendApi.interceptPendingBalanceRoute((route) =>
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                amount: 123,
                eurAmount: 123,
                usdAmount: 123,
                gbpAmount: 123,
            }),
        })
    );
    await blockchainHelper.withDisabledSession();
    await sdkHelper.init();
    await sdkHelper.openWalletModal();
    await modalPage.verifyPendingInformations(123);
});

test.fail(
    "should handle balance error",
    async ({ sdkHelper, backendApi, blockchainHelper, modalPage }) => {
        // Mock the  balance information
        await backendApi.interceptBalanceRoute((route) =>
            route.fulfill({
                status: 500,
            })
        );
        await blockchainHelper.withDisabledSession();
        await sdkHelper.init();
        await sdkHelper.openWalletModal();
        await modalPage.verifyBalanceInformations(1);
        // todo: should add error message
    }
);

test.fail(
    "should display pending error",
    async ({ sdkHelper, backendApi, blockchainHelper, modalPage }) => {
        // Mock the  pending information
        await backendApi.interceptPendingBalanceRoute((route) =>
            route.fulfill({
                status: 500,
            })
        );

        await blockchainHelper.withDisabledSession();
        await sdkHelper.init();
        await sdkHelper.openWalletModal();
        await modalPage.verifyPendingInformations(0);
        // todo: should add error message
    }
);
