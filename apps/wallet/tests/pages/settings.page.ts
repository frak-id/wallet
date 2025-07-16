import { type Page, expect } from "@playwright/test";

/**
 * Settings page helper
 */
export class SettingsPage {
    copyAuthenticatorInformation() {}
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
            this.page.getByText(
                "Biometry informationsAuthenticator: 0x5545...775051Wallet: 0xa162...6e6e42"
            )
        ).toBeVisible();

        await expect(
            this.page.getByText("Recovery setupSetup new")
        ).toBeVisible();
        await expect(this.page.getByText("Logout")).toBeVisible();
    }

    //verify the recovery button click
    async clickRecoveryButton() {
        const recoveryButton = this.page.getByText("Recovery setupSetup new");
        await expect(recoveryButton).toBeVisible();
        await recoveryButton.click();
        await this.page.waitForURL("/settings/recovery");
    }

    //verify the activate wallet button
    async clickActivateWalletButton() {
        await this.page.getByRole("switch").click();

        //verify the text after clicking activate wallet button
        await expect(
            this.page.getByText("Your wallet is activated")
        ).toBeVisible();
    }

    //verify the desactivate wallet button
    async clickDesactivateWalletButton() {
        await this.page.getByRole("switch").click();

        //verify the text after clicking desactivate wallet button
        await expect(
            this.page.getByText("Your wallet is non activated")
        ).toBeVisible();
    }

    // chek the authenticator button is visible
    async authenticatorButtonVisible() {
        const authenticatorButton = this.page
            .locator("button._walletAddress_1ys0n_1")
            .nth(0);
        await expect(authenticatorButton).toBeVisible();
    }

    // copy the authenticator button text
    async copyAuthenticatorInformations() {
        const authenticatorButton = this.page
            .locator("button._walletAddress_1ys0n_1")
            .nth(0);
        await expect(authenticatorButton).toBeVisible();

        // get the text content of the button
        const buttonText = await authenticatorButton.textContent();

        // click the authenticator button to copy its text
        await expect(authenticatorButton).toBeEnabled();
        await authenticatorButton.click();

        // read the clipboard content
        const clipboardText = await this.page.evaluate(() =>
            navigator.clipboard.readText()
        );

        // verify the clipboard content
        expect(clipboardText).toBe("0x7844...316a45");

        // with log
        expect(clipboardText).toBe(buttonText);

        console.log(`✅ trunc text cut: ${clipboardText}`);
        return clipboardText;
    }
}
