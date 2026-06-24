import { expect, type Page } from "@playwright/test";

/**
 * HomePage helper
 */
export class HomePage {
    constructor(private readonly page: Page) {}

    async navigateToHome() {
        await this.page.goto("/wallet");
        await this.page.waitForLoadState("networkidle");
    }

    // Redesigned home: "Wallet" title + the Rewards card.
    async verifyBasicsInformations() {
        await expect(
            this.page.getByRole("heading", { name: "Wallet", level: 1 })
        ).toBeVisible({ timeout: 10_000 });
        await expect(this.page.getByText("Rewards").first()).toBeVisible();
    }

    // Send page is reached via the Transfer modal; navigate directly here.
    async navigateToSend() {
        await this.page.goto("/tokens/send");
        await this.page.waitForURL("/tokens/send");
        await this.page.waitForLoadState("networkidle");
    }

    async verifyDisplaySendPage() {
        await expect(
            this.page.getByRole("heading", {
                name: "Transfer to a crypto wallet",
                level: 1,
            })
        ).toBeVisible({ timeout: 10_000 });
        await expect(
            this.page.getByRole("textbox", { name: "Enter address" })
        ).toBeVisible();
    }

    // Send page's generic Back control (aria-label "Back") returns to home.
    async clickBackToWalletPage() {
        await this.page
            .getByRole("link", { name: "Back", exact: true })
            .click();
        await this.page.waitForURL("/wallet");
        await this.page.waitForLoadState("networkidle");
    }

    // Wallet tab. "Porte-monnaie" is a hardcoded FR label in AppShell (not i18n).
    async clickWalletButton() {
        const walletLinkLocator = this.page.getByRole("link", {
            name: "Porte-monnaie",
        });
        await expect(walletLinkLocator).toBeVisible();
        await walletLinkLocator.click();
        await this.page.waitForURL("/wallet");
    }

    // Match the Rewards integer exactly (loose match also hits the Lifetime
    // stat) and allow time for the mock-backed refetch to settle from 0.
    async verifyBalanceInformations(amount: number) {
        await expect(
            this.page.getByText(amount.toString(), { exact: true }).first()
        ).toBeVisible({ timeout: 15_000 });
    }
}
