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

    //verify that the settings page is well displayed
    async verifyDisplaySettingsPage() {
        await expect(
            this.page.getByText("Biometry informations")
        ).toBeVisible();
        await expect(this.page.getByText('Wallet not activated Activate')).toBeVisible();
        await expect(this.page.getByText("Recovery setup")).toBeVisible();
        await expect(this.page.getByRole('link', { name: 'Setup new recovery' })).toBeVisible();
        await expect(this.page.getByText("Logout")).toBeVisible();
    }

    /**
     * Click on the recovery button
     */
    async clickRecoveryButton() {
        const recoveryButton = this.page.getByText("Setup new recovery");
        await expect(recoveryButton).toBeVisible();
        await recoveryButton.click();
        await this.page.waitForURL("/settings/recovery");
    }

    // verify the activate wallet button
    async clickActivateWalletButton() {
        await this.page.getByRole("switch").click();

        //verify the text after clicking activate wallet button
        await expect(
            this.page.getByText("Your wallet is activated")
        ).toBeVisible();
    }

    // verify the desactivate wallet button
    async clickDesactivateWalletButton() {
        await this.page.getByRole("switch").click();

        //verify the text after clicking desactivate wallet button
        await expect(
            this.page.getByText("Your wallet is non activated")
        ).toBeVisible();
    }

    // chek the authenticator button is visible
    async authenticatorButtonVisible() {
        const authenticatorButton = this.page.getByText(
            "Authenticator: 0x5545...565051"
        );
        await expect(authenticatorButton).toBeVisible();
    }

    // copy the authenticator button text
    async copyAuthenticatorInformations() {
        const authenticatorButton = this.page
            .locator("button._walletAddress_1ys0n_1")
            .nth(0);
        await expect(authenticatorButton).toBeVisible();

        // click the authenticator button and copy the text
        await expect(authenticatorButton).toBeEnabled();
        await authenticatorButton.click();
    }

    async verifyWalletButton() {
        // Verify that the "wallet:"" button is visible
        await expect(
            this.page.getByText(/Wallet: [A-Za-z0-9.]+$/i)
        ).toBeVisible();
    }
}
