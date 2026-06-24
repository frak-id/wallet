import { expect, type Page } from "@playwright/test";

export class HistoryPage {
    constructor(private readonly page: Page) {}

    async navigateToHistory() {
        await this.page.goto("/history");
        await this.page.waitForURL("/history");
    }

    // Redesigned history: "Earnings history" title + summary card (no tabs).
    async verifyDisplayHistoryPage() {
        await expect(
            this.page.getByRole("heading", { name: "Earnings history" })
        ).toBeVisible({ timeout: 10_000 });
        await expect(this.page.getByText("Total earnings")).toBeVisible();
    }

    // Notifications bell removed from history; reach the page directly.
    async navigateToNotifications() {
        await this.page.goto("/notifications");
        await this.page.waitForURL("/notifications");
    }

    // A fresh wallet renders the empty-state title.
    async verifyDisplayNotificationsPage() {
        await expect(this.page.getByText("No notifications")).toBeVisible({
            timeout: 10_000,
        });
    }
}
