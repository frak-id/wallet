import { test } from "../../fixtures";

// No history button on home anymore; navigate directly.
test("should display history page", async ({ historyPage }) => {
    await historyPage.navigateToHistory();
    await historyPage.verifyDisplayHistoryPage();
});

// Notifications bell removed from history; navigate directly.
test("should display the notifications page", async ({ historyPage }) => {
    await historyPage.navigateToNotifications();
    await historyPage.verifyDisplayNotificationsPage();
});
