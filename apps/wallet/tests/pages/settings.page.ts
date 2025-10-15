import { expect, type Page } from "@playwright/test";

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

    async verifyBiometryInformation() {
        // the biometry block is visible
        await expect(
            this.page.getByText("Biometry informations")
        ).toBeVisible();
        const authenticatorButton = this.page.getByText(
            /Authenticator: [A-Za-z0-9.]+$/i
        );
        await expect(authenticatorButton).toBeVisible();
        await expect(
            this.page.getByText(/Wallet: [A-Za-z0-9.]+$/i)
        ).toBeVisible();
    }

    async verifyRecoverySetup() {
        // Verify the recovery setup section is visible
        await expect(this.page.getByText("Recovery setup")).toBeVisible();
        await expect(
            this.page.getByRole("link", { name: "Setup new recovery" })
        ).toBeVisible();
    }

    async verifyRecoverySetupPage() {
        // Verify the recovery setup page  is visible
        await this.page.waitForURL("settings/recovery");
        await expect(this.page.getByText("Warning")).toBeVisible();
    }

    async verifyLogoutButton() {
        // Verify the logout button is visible
        await expect(this.page.getByText("Logout")).toBeVisible();
    }

    //new test with false
    async verifyUnsubscribeNotifications() {
        await expect(this.page.getByText("unsubscribe")).toBeVisible();
    }

    async verifyUnsubscribeNotificationsNotVisible() {
        await expect(this.page.getByText("unsubscribe")).not.toBeVisible();
    }

    async verifyPairedWallets() {}

    // copy the authenticator button text
    async clickCopyAuthenticatorInformations() {
        const authenticatorButton = this.page.getByText(
            /Authenticator: [A-Za-z0-9.]+$/i
        );
        await expect(authenticatorButton).toBeVisible();
        // click the authenticator button and copy the text
        await expect(authenticatorButton).toBeEnabled();
        await authenticatorButton.click();
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

    // Verify the disable status display
    async verifyDisplayDisableStatus() {
        await expect(this.page.getByText("Activate your wallet")).toBeVisible();
        await expect(this.page.getByText("Wallet not activated")).toBeVisible();
    }

    // Verify the enable status display
    async verifyDisplayEnableStatus() {
        await expect(
            this.page.getByText("Your wallet is activated")
        ).toBeVisible();
        await expect(
            this.page.getByText("Wallet is activated").first()
        ).toBeVisible();
    }

    /**
     * Click the activate wallet button
     */
    async clickActivateWalletButton() {
        await this.page
            .getByText("Your wallet is activated")
            .getByRole("switch")
            .click();
    }

    /**
     * Click the desactivate wallet button
     */
    async clickDesactivateWalletButton() {
        await this.page
            .getByText("Activate your wallet")
            .getByRole("switch")
            .click();
    }

    //verify logout button click
    async clickLogoutButton() {
        // Verify the logout button is visible
        await expect(this.page.getByText("Logout")).toBeVisible();
        await this.page.getByText("Logout").click();
    }
}
