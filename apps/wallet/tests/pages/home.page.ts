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

    /**
     * Verify that the wallet basics informations are visible on the home page.
     * This includes the balance, receive and send buttons, and the refresh button.
     */
    async verifyBasicsInformations() {
        const isSoldeVisible = await this.page.getByText("Balance").isVisible();
        expect(isSoldeVisible).toBeTruthy();

        await expect(
            this.page.getByRole("link", { name: "Receive" })
        ).toBeVisible();
        await expect(
            this.page.getByRole("link", { name: "Send" })
        ).toBeVisible();
        await expect(
            this.page.getByRole("button", { name: "Refresh" })
        ).toBeVisible();
    }

    async clickReveive() {
        await this.page.getByRole("link", { name: "Receive" }).click();
        await this.page.waitForURL("/tokens/receive");
    }

    async verifyDisplayReceivedPage() {
        await expect(
            this.page.getByRole("link", { name: "Back to wallet page" })
        ).toBeVisible();
        await expect(
            this.page.getByRole("img", { name: "QR Code" })
        ).toBeVisible();
        await expect(
            this.page.getByRole("button", { name: "Copy address" })
        ).toBeVisible();
    }
}
