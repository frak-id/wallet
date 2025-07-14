import { type Page, expect } from "@playwright/test";

/**
 * Settings page helper
 */
export class SettingsPage {
    constructor(private readonly page: Page) {}

    async navigateToSettings() {
        await this.page.goto("/settings");
        await this.page.waitForLoadState("networkidle");
    }
    async clickLogout() {
        await this.page.locator("button", { hasText: "Logout" }).click();
    }

    //verify the settings button and click it
    async clickSettingsButton() {
        // Ensure the settings button is visible and clickable
        const settingsLinkLocator = this.page.locator(
            "a:has(svg.lucide-settings)"
        );
        await expect(settingsLinkLocator).toBeVisible();
        await settingsLinkLocator.click();
        await this.page.waitForURL("/settings");
    }

    //verify that the settings page is displayed and the heading is visible
    async verifyDisplaySettingsPage() {
        await this.page
            .getByRole("heading", { name: "Biometry informations" })
            .click();
        await this.page.getByText("Wallet not activated Activate").click();
        await this.page.getByText("Recovery setupSetup new").click();
    }
}
