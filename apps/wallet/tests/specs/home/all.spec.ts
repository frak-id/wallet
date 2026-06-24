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
}) => {
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
