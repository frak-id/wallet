import { expect, type Page } from "@playwright/test";

/**
 * Settings page helper
 */
export class SettingsPage {
    constructor(private readonly page: Page) {}

    async navigateToSettings() {
        await this.page.goto("/profile");
        await this.page.waitForURL("/profile");
    }

    // Profil tab. "Profil" is a hardcoded FR label in AppShell (not i18n).
    async clickSettingsButton() {
        const settingsLinkLocator = this.page.getByRole("link", {
            name: "Profil",
        });
        await expect(settingsLinkLocator).toBeVisible();
        await settingsLinkLocator.click();
        await this.page.waitForURL("/profile");
    }

    // Asserts the profile rendered. (No biometry check: the authenticator row
    // is webauthn-only, hence the generic name.)
    async verifyProfileIdentity() {
        await expect(
            this.page.getByRole("heading", { name: "Profil" })
        ).toBeVisible();
        // Wallet row is always present (Authenticator row is webauthn-only).
        await expect(this.page.getByText("Wallet:").first()).toBeVisible();
    }

    // Notifications are now a labelled row + toggle (no "unsubscribe" block).
    async verifyNotificationsSetting() {
        await expect(
            this.page.getByText("Notifications").first()
        ).toBeVisible();
        await expect(this.page.getByRole("switch").first()).toBeVisible();
    }

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

    // "Recovery options" only shows once configured; a fresh wallet reaches the
    // setup flow via /profile/recovery (redirects to /profile/recovery/setup).
    async navigateToRecovery() {
        await this.page.goto("/profile/recovery");
    }

    async verifyRecoverySetupPage() {
        await this.page.waitForURL(/\/profile\/recovery(\/setup)?/);
        // The setup flow opens on the password step.
        await expect(this.page.getByText("Protect your recovery")).toBeVisible({
            timeout: 10_000,
        });
    }
}
