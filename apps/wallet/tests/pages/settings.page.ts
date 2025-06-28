import type { Page } from "@playwright/test";

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
}
