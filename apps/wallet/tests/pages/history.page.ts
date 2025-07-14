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

    // Click the notifications button
    async clickNotificationsButton() {
        await this.page.locator("button", { hasText: "Notifications" }).click();
    }
}
