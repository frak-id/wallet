import { type Page, expect } from "@playwright/test";

/**
 * HomePage helper
 */
export class HomePage {
    constructor(private readonly page: Page) {}

    async navigateToHome() {
        await this.page.goto("/wallet");
        await this.page.waitForLoadState("networkidle");
    }

    async verifyBalance() {
        const isSoldeVisible = await this.page.getByText("Balance").isVisible();
        expect(isSoldeVisible).toBeTruthy();
    }
}
