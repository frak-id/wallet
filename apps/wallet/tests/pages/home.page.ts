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

    //verify button return to home
    async clickBackToWalletPage() {
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
    }

    //verify the wallet button and click it
    async clickWalletButton() {
        // Ensure the wallet button is visible and clickable
        // finding the locator  wallet button by the SVG icon in the html
        const walletLinkLocator = this.page.locator("a:has(svg.lucide-wallet)");
        await expect(walletLinkLocator).toBeVisible();
        await walletLinkLocator.click();
        await this.page.waitForURL("/wallet");
    }

    //verify clipboard
    async clickCopyAddressButton() {
        // Get the locator for the copy address button
        const copyAddressButton = this.page.getByRole("button", {
            name: "Copy address",
        });

        // Ensure the copy address button is visible and clickable
        await expect(copyAddressButton).toBeVisible();
        await expect(copyAddressButton).toBeEnabled();

        // Click the copy address button
        await copyAddressButton.click();
    }

    // Verify that the address is copied to clipboard
    // miss the adress to fill in the copyadress button
    async verifyClipboardText(): Promise<void> {
        // It's best to pass the expected value
        const clipboardText: string = await this.page.evaluate(
            (): Promise<string> => navigator.clipboard.readText()
        );

        //verify the clipboard is not empty
        expect(clipboardText).toBeDefined();
        expect(clipboardText).not.toHaveLength(0);
    }
}
