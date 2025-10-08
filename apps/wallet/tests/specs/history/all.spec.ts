import { test } from "../../fixtures";

// Verify the history button and click it
test("should display history page when history button clicked", async ({
    homePage,
    historyPage,
}) => {
    // Navigate to the home page
    await homePage.navigateToHome();
    // Verify that the wallet basics information is visible on the home page

    // Verify the historybutton is visible and click it
    await historyPage.clickHistoryButton();

    // Verify that the history page is displayed
    historyPage.verifyDisplayHistoryPage;
});

// Verify display Notifications button
test("should display notifications button ", async ({ historyPage }) => {
    // Navigate to the history page
    await historyPage.navigateToHistory();
    // Verify that the history page is displayed with rewards and interactions
    await historyPage.verifyDisplayHistoryPage();
    // Verify that the notifications button is visible
    await historyPage.notificationsButtonVisible();
});

// Click the notifications button
test("should click notifications button ", async ({ historyPage }) => {
    await historyPage.navigateToHistory();
    await historyPage.notificationsButtonVisible();
    //verify the notification button is visible and click it
    await historyPage.clickNotificationsButton();
    // todo: verify notification page is displayed
});

// Verify the notifications page is displayed
test("should display notifications page when notifications button clicked", async ({
    historyPage,
}) => {
    // Navigate to the history page
    await historyPage.navigateToHistory();
    // Click the notifications button
    await historyPage.clickNotificationsButton();
    // Verify that the notifications page is displayed
    await historyPage.verifyDisplayNotificationsPage();
});

// Verify display history datas
test("should display history rewards datas", async ({
    historyPage,
    indexerApi,
}) => {
    await indexerApi.mockRewardsHistoryDatas();
    await historyPage.navigateToHistory();
    await historyPage.clickRewardsButton();
    await historyPage.verifyRewardsDataDisplayed();
});

test.fail(
    "should display error message with rewards datas ",
    async ({ historyPage, indexerApi }) => {
        await indexerApi.interceptRewardHistoryRoute((route) =>
            route.fulfill({
                status: 500,
            })
        );
        await historyPage.navigateToHistory();
        await historyPage.clickRewardsButton();
        await historyPage.verifyRewardsDataDisplayed();
        // todo: should add error message
    }
);
test("should display history interactions datas", async ({
    historyPage,
    indexerApi,
}) => {
    await indexerApi.mockInteractionsHistoryDatas();
    await historyPage.navigateToHistory();
    await historyPage.clickInteractionsButton();
    await historyPage.verifyInteractionsDataDisplayed();
});

test.fail(
    "should display error message with interactions datas ",
    async ({ historyPage, indexerApi }) => {
        await indexerApi.interceptInteractionsHistoryRoute((route) =>
            route.fulfill({
                status: 500,
            })
        );
        await historyPage.navigateToHistory();
        await historyPage.clickInteractionsButton();
        await historyPage.verifyInteractionsDataDisplayed();
        // todo: should add error message
    }
);
