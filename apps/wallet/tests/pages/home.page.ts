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

    /**
     * Verify that the wallet basics informations are visible on the home page.
     * This includes the balance, receive and send buttons, and the refresh button.
     */
    async verifyBasicsInformations() {
        await expect(this.page.getByText("Balance")).toBeVisible({
            timeout: 500,
        });
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

    /**
     * Verify that the wallet basics informations are visible on the home page.
     * This includes the balance, receive and send buttons, and the refresh button.
     */
    async verifyActivateToggleDisplayed() {
        await expect(this.page.getByText("Activate your wallet")).toBeVisible();
        await expect(
            this.page.getByText("Activate your wallet").getByRole("switch")
        ).toBeVisible();
    }

    /**
     * Verify that the wallet basics informations are visible on the home page.
     * This includes the balance, receive and send buttons, and the refresh button.
     */
    async clickActivateToggle() {
        await this.page
            .getByText("Activate your wallet")
            .getByRole("switch")
            .click();
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Verify that the wallet basics informations are visible on the home page.
     * This includes the balance, receive and send buttons, and the refresh button.
     */
    async verifyActivateToggleHidden() {
        await expect(
            this.page.getByText("Activate your wallet")
        ).not.toBeVisible();
        await expect(
            this.page.getByText("Activate your wallet").getByRole("switch")
        ).not.toBeVisible();
    }

    async clickReceive() {
        await this.page.getByRole("link", { name: "Receive" }).click();
        await this.page.waitForURL("/tokens/receive");
        await this.page.waitForLoadState("networkidle");
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

    // Verify button return to home
    async clickBackToWalletPage() {
        await this.page
            .getByRole("link", { name: "Back to wallet page" })
            .click();
        await this.page.waitForURL("/wallet");
        await this.page.waitForLoadState("networkidle");
    }

    // Display the token send page when click the send button
    async clickSend() {
        await this.page.getByRole("link", { name: "Send" }).click();
        await this.page.waitForURL("/tokens/send");
        await this.page.waitForLoadState("networkidle");
    }

    async verifyDisplaySendPage() {
        await expect(
            this.page.getByRole("link", { name: "Back to wallet page" })
        ).toBeVisible();
        await expect(
            this.page.getByRole("textbox", { name: "Enter address" })
        ).toBeVisible();
    }

    // Refresh button click
    async clickRefresh() {
        await this.page.getByRole("button", { name: "Refresh" }).click();
        await this.page.waitForLoadState("networkidle");
    }

    // Verify the wallet button and click it
    async clickWalletButton() {
        // Ensure the wallet button is visible and clickable
        // finding the locator  wallet button by the SVG icon in the html
        const walletLinkLocator = this.page.locator("a:has(svg.lucide-wallet)");
        await expect(walletLinkLocator).toBeVisible();
        await walletLinkLocator.click();
        await this.page.waitForURL("/wallet");
    }

    // Verify clipboard
    async clickCopyAddressButton() {
        // Get the copy address button locator
        const copyAddressButton = this.page.getByRole("button", {
            name: "Copy address",
        });

        // Ensure the copy address button is visible and clickable
        await expect(copyAddressButton).toBeVisible();
        await expect(copyAddressButton).toBeEnabled();

        // Click the copy address button
        await copyAddressButton.click();
    }

    // Verify balance informations
    async verifyBalanceInformations(amount: number) {
        await expect(this.page.getByText(amount.toString())).toBeVisible();
    }

    // Verify claimable balance informations
    async verifyClaimableBalanceInformations(amount: number) {
        await expect(this.page.getByText(amount.toString())).toBeVisible();

        await expect(
            this.page.getByText("Pending referral reward")
        ).toBeVisible();
        await expect(this.page.getByText("You got")).toBeVisible();

        // verify display claimable Button
        const claimButton = this.page.getByRole("button", { name: "Claim" });
        await expect(claimButton).toBeVisible();
    }

    // Click claim button
    async clickClaim() {
        await this.page.getByRole("button", { name: "Claim" }).click();
    }

    // Verify click claim button success
    async verifyClaimSuccess() {
        await expect(
            this.page.getByText("You have claimed your reward successfully!")
        ).toBeVisible();
    }
}
