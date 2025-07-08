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

    async clickReceive() {
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

    async verifyReturnToHome() {
        await expect(
            this.page.getByRole("link", { name: "Back to wallet page" })
        ).toBeVisible();
        await this.page
            .getByRole("link", { name: "Back to wallet page" })
            .click();
        await this.page.waitForURL("/wallet");
    }

    // Display the token send page when the send button is clicked
    async clickSend() {
        await this.page.getByRole("link", { name: "Send" }).click();
        await this.page.waitForURL("/tokens/send");
    }

    async verifyDisplaySendPage() {
        await expect(
            this.page.getByRole("link", { name: "Back to wallet page" })
        ).toBeVisible();
        await expect(
            this.page.getByRole("textbox", { name: "Enter address" })
        ).toBeVisible();
    }

    //refresh button click
    async clickRefresh() {
        await this.page.getByRole("button", { name: "Refresh" }).click();
        // Wait for the page to reload
        await this.page.waitForLoadState("networkidle");
        // Verify that the balance is still visible after refresh
        const isSoldeVisible = await this.page.getByText("Balance").isVisible();
        expect(isSoldeVisible).toBeTruthy();
    }

    //verify the wallet button and click it
    async clickWalletButton() {
        // Ensure the wallet button is visible and clickable
        // finding the locator  wallet button by the SVG icon in the html
        const walletLinkLocator = this.page.locator("a:has(svg.lucide-wallet)");
        //await this.page.setViewportSize({ width: 1920, height: 1080 }); if we want  to have a best test view
        await expect(walletLinkLocator).toBeVisible();
        await walletLinkLocator.click();
        await this.page.waitForURL("/wallet");
    }

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
    //verify that the history page is displayed with rewards and interactions
    async verifyDisplayHistoryPage() {
        await expect(
            this.page.getByRole("button", { name: "rewards" })
        ).toBeVisible();
        await expect(
            this.page.getByRole("button", { name: "Interactions" })
        ).toBeVisible();
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

    //verify clipboard text to be true
    async clickCopyAddressButton() {
        // Ensure the copy address button is visible and clickable
        const copyAddressButton = this.page.getByRole("button", {
            name: "Enter address",
        });
        await expect(copyAddressButton).toBeVisible();
        await copyAddressButton.click();

        // Wait for the clipboard to be updated
        await this.page.waitForTimeout(1000); // Adjust the timeout as needed

        //verify the clipboard text
        const clipboardText = await this.page.evaluate(() => {
            return navigator.clipboard.readText();
        });
        expect(clipboardText).toBeTruthy();

        // Return the clipboard text for further verification if needed
        return clipboardText;
    }
}
