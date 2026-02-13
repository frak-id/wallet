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

// Verify the balance pending
test("should have the good balance pending", async ({
    sdkHelper,
    modalPage,
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
    await sdkHelper.init();
    await sdkHelper.openWalletModal();
    await modalPage.verifyPendingInformations(123);
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

test.fail(
    "should display pending error",
    async ({ sdkHelper, backendApi, modalPage }) => {
        // Mock the  pending information
        await backendApi.interceptPendingBalanceRoute((route) =>
            route.fulfill({
                status: 500,
            })
        );

        await sdkHelper.init();
        await sdkHelper.openWalletModal();
        await modalPage.verifyPendingInformations(0);
        // todo: should add error message
    }
);
