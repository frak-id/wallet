import { type Page, expect } from "@playwright/test";

export class HistoryPage {
    constructor(private readonly page: Page) {}

    // Verify the history button and click it
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

    // Verify that the history page is displayed with rewards and interactions
    async verifyDisplayHistoryPage() {
        await expect(
            this.page.getByRole("button", { name: "rewards" })
        ).toBeVisible();
        await expect(
            this.page.getByRole("button", { name: "Interactions" })
        ).toBeVisible();
    }

    // Check the notifications button visible
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

    // Verify that the notifications page is displayed
    async verifyDisplayNotificationsPage() {
        await expect(
            this.page.getByRole("heading", { name: "Notifications" })
        ).toBeVisible();
    }

    // Verify the Rewards button
    async clickRewardsButton() {
        const rewardsButtonLocator = this.page.getByRole("button", {
            name: "Rewards",
        });

        await expect(rewardsButtonLocator).toBeVisible();
        await rewardsButtonLocator.click();
        await this.page.waitForLoadState("networkidle");
    }

    // Verify Rewards datas display
    async verifyRewardsDataDisplayed() {
        // Verify "added" rewards
        await expect(
            this.page.getByText("e2e Test - added").first()
        ).toBeVisible();
        await expect(
            this.page.getByText("e2e Test - claimed").first()
        ).toBeVisible();
    }

    // verify the Rewards button
    async clickInteractionsButton() {
        const interactionsButtonLocator = this.page.getByRole("button", {
            name: "Interactions",
        });

        await expect(interactionsButtonLocator).toBeVisible();
        await interactionsButtonLocator.click();
        await this.page.waitForLoadState("networkidle");
    }

    // verify Rewards datas display
    async verifyInteractionsDataDisplayed() {
        // Verify "added" rewards
        await expect(
            this.page.getByText("e2e Test - Created share link").first()
        ).toBeVisible();
        await expect(
            this.page.getByText("e2e Test - Appointment in store").first()
        ).toBeVisible();
        await expect(
            this.page.getByText("e2e Test - Referred").first()
        ).toBeVisible();
    }
}
