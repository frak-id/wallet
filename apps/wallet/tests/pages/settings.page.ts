import { expect, type Page } from "@playwright/test";

/**
 * Settings page helper
 */
export class SettingsPage {
    constructor(private readonly page: Page) {}

    async navigateToSettings() {
        await this.page.goto("/profile");
        await this.page.waitForLoadState("networkidle");
    }

    //verify the settings button and click it
    async clickSettingsButton() {
        const settingsLinkLocator = this.page.getByRole("button", {
            name: /profil/i,
        });
        await expect(settingsLinkLocator).toBeVisible();
        await settingsLinkLocator.click();
        await this.page.waitForURL("/profile");
    }

    async verifyBiometryInformation() {
        await expect(
            this.page.getByRole("heading", { name: "Profil" })
        ).toBeVisible();
        await expect(
            this.page.getByText(/Authenticator:|Authentificateur :/i)
        ).toBeVisible();
        await expect(
            this.page.getByText(/Wallet:|Porte-monnaie :|Account ID:/i)
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
        await this.page.waitForURL("/profile/recovery");
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
        const authenticatorButton = this.page
            .getByRole("button", {
                name: /copy address|copier l'adresse/i,
            })
            .first();
        await expect(authenticatorButton).toBeVisible();
        await expect(authenticatorButton).toBeEnabled();
        await authenticatorButton.click();
    }

    /**
     * Click on the recovery button
     */
    async clickRecoveryButton() {
        const recoveryButton = this.page.getByRole("link", {
            name: /setup new recovery|configurer une nouvelle récupération/i,
        });
        await expect(recoveryButton).toBeVisible();
        await recoveryButton.click();
        await this.page.waitForURL("/profile/recovery");
    }

    //verify logout button click
    async clickLogoutButton() {
        // Verify the logout button is visible
        await expect(this.page.getByText("Logout")).toBeVisible();
        await this.page.getByText("Logout").click();
    }
}
