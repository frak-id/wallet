import { type Page, expect } from "@playwright/test";

export class HistoryPage {
    constructor(private readonly page: Page) {}

    //verify the history button and click it
    async clickHistoryButton() {
        // Ensure the history button is visible and clickable
        const historyLinkLocator = this.page.locator(
            "a:has(svg.lucide-history)"
        );
        await expect(historyLinkLocator).toBeVisible();
        await historyLinkLocator.click();
        await this.page.waitForURL("/history");
    }

    async navigateToHistory() {
        await this.page.goto("/history");
        await this.page.waitForLoadState("networkidle");
    }

    //verify that the history page is displayed with rewards and interactions
    async verifyDisplayHistoryPage() {
        await expect(
            this.page.getByRole("button", { name: "rewards" })
        ).toBeVisible();
        await expect(
            this.page.getByRole("button", { name: "Interactions" })
        ).toBeVisible();
    }

    //check the notifications button visible
    async notificationsButtonVisible() {
        // try to find the notifications button using  selectoors
        const notificationsButton = this.page
            .locator('a:has(svg title:text("Notifications"))')
            .first();

        await expect(notificationsButton).toBeVisible();
    }

    // Click the notifications button
    async clickNotificationsButton() {
        const notificationsButton = this.page
            .locator('a:has(svg title:text("Notifications"))')
            .first();

        await notificationsButton.click();
        await this.page.waitForURL("/notifications");
        await this.page.waitForLoadState("networkidle");
    }
}
