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

    //verify the settings button and click it
    async SettingsButton() {
        // Ensure the settings button is visible and clickable
        const settingsLinkLocator = this.page.locator(
            "a:has(svg.lucide-settings)"
        );
        await expect(settingsLinkLocator).toBeVisible();
    }

    async verifyBiometryInformation() {
        // the biometry block is visible
        await expect(
            this.page.getByText("Biometry informations")
        ).toBeVisible();
    }

    async verifyRecoverySetup() {
        // Verify the recovery setup section is visible
        await expect(this.page.getByText("Recovery setup")).toBeVisible();
        await expect(
            this.page.getByRole("link", { name: "Setup new recovery" })
        ).toBeVisible();
    }

    async verifyLogoutButton() {
        // Verify the logout button is visible
        await expect(this.page.getByText("Logout")).toBeVisible();
    }

    async verifyActivateWalletButton() {
        // Just check checkbox is present, not it's state
        await expect(this.page.getByText("Wallet not activated")).toBeVisible();
    }

    async verifyNotificationsButton() {
        await expect(
            this.page.getByRole("link", { name: "Notifications" })
        ).toBeVisible();
    }
    
    async verifyNotificationsButtonClick() {
        const notificationsButton = this.page.getByRole("link", {
            name: "Notifications",
        });
        await expect(notificationsButton).toBeVisible();
        await notificationsButton.click();
        await this.page.waitForURL("/notifications");
    }

    async verifyUnsubscribeNotifications() {
        await expect(this.page.getByText("unsubscribe")).toBeVisible();
    }

    async verifyPairedWallets() {
        // todo: for later
    }

    // chek the authenticator button is visible
    async verifyAuthenticatorButton() {
        const authenticatorButton = this.page.getByText(
            /Authenticator: [A-Za-z0-9.]+$/i
        );
        await expect(authenticatorButton).toBeVisible();
    }

    // copy the authenticator button text
    async copyAuthenticatorInformations() {
        const authenticatorButton = this.page.getByText(
            /Authenticator: [A-Za-z0-9.]+$/i
        );
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
}
