import { test } from "../../fixtures";

test.beforeEach(async ({ mockedWebAuthN }) => {
    await mockedWebAuthN.setup();
});

// the wallet basics informations are visible on the home page
test("should display wallet basics informations", async ({ homePage }) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
});

// Home has no Send link now; the transfer page is reached via the modal.
test("should display the crypto transfer (send) page", async ({ homePage }) => {
    await homePage.navigateToSend();
    await homePage.verifyDisplaySendPage();
});

// Back from the send page returns to the wallet home.
test("should handle back to wallet from send page", async ({ homePage }) => {
    await homePage.navigateToSend();
    await homePage.verifyDisplaySendPage();
    await homePage.clickBackToWalletPage();
    await homePage.verifyBasicsInformations();
});

// Verify the wallet tab navigation
test("should display wallet page when wallet button clicked", async ({
    homePage,
}) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    // Click the wallet tab
    await homePage.clickWalletButton();
    // Verify that the wallet page is displayed
    await homePage.verifyBasicsInformations();
});

test("should display the correct total balance on the home page", async ({
    homePage,
    backendApi,
}, testInfo) => {
    // The distant-webauthn paired session has no connected address, so the
    // balance query (and this mock) never runs there.
    test.skip(
        testInfo.project.name === "chromium-paired",
        "balance fetch needs a connected on-device wallet"
    );
    // Mock the  balance information
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

    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    await homePage.verifyBalanceInformations(420);
});

// Rewards-card stat triggers open their empty-state modals (zero wallet).
// Transfer/Lifetime open the empty modals only when the balance is <= 0, so
// mock a zero balance rather than relying on the live wallet staying empty.
const zeroBalance = {
    status: 200,
    body: JSON.stringify({
        total: { amount: 0, eurAmount: 0, usdAmount: 0, gbpAmount: 0 },
        balances: [],
    }),
};

test("Transfer to my bank opens the empty-transfer modal", async ({
    homePage,
    backendApi,
}) => {
    await backendApi.interceptBalanceRoute((route) =>
        route.fulfill(zeroBalance)
    );
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    await homePage.clickTransferToBank();
    await homePage.verifyModalText("You don't have any money to transfer yet");
});

// Pending reads claimable rewards on-chain (naturally zero on a fresh wallet).
test("Pending stat opens the empty-earnings modal", async ({ homePage }) => {
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    await homePage.clickPendingStat();
    await homePage.verifyModalText("You don't have any earnings yet");
});

test("Lifetime stat opens the empty-transferred modal", async ({
    homePage,
    backendApi,
}) => {
    await backendApi.interceptBalanceRoute((route) =>
        route.fulfill(zeroBalance)
    );
    await homePage.navigateToHome();
    await homePage.verifyBasicsInformations();
    await homePage.clickLifetimeStat();
    await homePage.verifyModalText("You haven't transferred any earnings yet");
});
