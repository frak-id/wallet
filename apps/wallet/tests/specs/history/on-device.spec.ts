import { test } from "../../fixtures";

// verify the history button and click it
test("should display history page when history button clicked", async ({
    homePage,
    historyPage,
}) => {
    // Navigate to the home page
    await homePage.navigateToHome();
    // Verify that the wallet basics information is visible on the home page

    //verify the historybutton is visible and click it
    await historyPage.clickHistoryButton();

    // Verify that the history page is displayed
    historyPage.verifyDisplayHistoryPage;
});

// verify display Notifications button
test("notifications button visible", async ({ historyPage }) => {
    // Navigate to the history page
    await historyPage.navigateToHistory();
    // Verify that the history page is displayed with rewards and interactions
    await historyPage.verifyDisplayHistoryPage();
    // Verify that the notifications button is visible
    await historyPage.notificationsButtonVisible();
});

// Click the notifications button
test("notifications button click", async ({ historyPage }) => {
    await historyPage.navigateToHistory();
    await historyPage.notificationsButtonVisible();
    //verify the notification button is visible and click it
    await historyPage.clickNotificationsButton();
    // todo: verify notification page is displayed
});

//verify the notifications page is displayed
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
