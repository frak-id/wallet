import { expect, type Page } from "@playwright/test";

/**
 * Auth page helper
 * TODO: SSO + pairing navigation
 */
export class AuthPage {
    constructor(private readonly page: Page) {}

    /* -------------------------------------------------------------------------- */
    /*                            Registration specific                           */
    /* -------------------------------------------------------------------------- */

    async navigateToRegister() {
        await this.page.goto("/register");
        await this.page.waitForLoadState("networkidle");
        await this.page.waitForURL("/register");
    }

    /**
     * Navigate through onboarding slides to reach the Keypass step.
     * Does NOT trigger WebAuthn — use clickRegister() for full registration.
     */
    async navigateToKeypass() {
        // Click through slides 1 and 2
        await this.page.locator("button", { hasText: "Continue" }).click();
        await this.page.waitForTimeout(600); // Allow scroll animation + IntersectionObserver
        await this.page.locator("button", { hasText: "Continue" }).click();
        // Wait for last slide button to appear (confirms slide 3 active)
        await expect(
            this.page.locator("button", {
                hasText: "Activate my secure space",
            })
        ).toBeVisible({ timeout: 5_000 });
        await this.page.waitForTimeout(600);
        await this.page
            .locator("button", {
                hasText: "Activate my secure space",
            })
            .click();
        // Wait for Keypass screen
        await expect(
            this.page.getByRole("heading", {
                name: "Secure your account",
            })
        ).toBeVisible({ timeout: 5_000 });
    }

    async clickRegister() {
        await this.navigateToKeypass();
        // Click "Continue" on Keypass — triggers WebAuthn
        await this.page.locator("button", { hasText: "Continue" }).click();
    }

    async clickGoToLogin() {
        await this.page
            .locator("a", { hasText: "Use an existing wallet" })
            .click();
    }

    async verifyRegistrationReady() {
        await expect(this.page).toHaveURL("/register");
        // Verify the first onboarding slide is visible
        await expect(
            this.page.getByRole("heading", {
                name: "Slide 1 — Title placeholder",
            })
        ).toBeVisible({ timeout: 10_000 });
    }

    async verifyRegistrationError() {
        // Wait for the Keypass screen to show an error message
        await expect(this.page.locator("p.error")).toBeVisible({
            timeout: 5_000,
        });
    }

    async verifyWelcomeScreen() {
        await expect(
            this.page.getByRole("heading", {
                name: "Welcome to your wallet",
            })
        ).toBeVisible({ timeout: 10_000 });
    }

    async clickContinueOnWelcome() {
        await this.page.locator("button", { hasText: "Get started" }).click();
    }

    async verifyDuplicateWalletError() {
        const locator = { hasText: "You already have a wallet on your device" };
        // Wait for the button to be visible
        await this.page
            .locator("button", locator)
            .waitFor({ state: "visible", timeout: 5_000 });
        // Verify the error is visible
        const hasErrorInButton = await this.page
            .locator("button", locator)
            .isVisible();
        expect(hasErrorInButton).toBeTruthy();
    }

    /* -------------------------------------------------------------------------- */
    /*                               Login specific                               */
    /* -------------------------------------------------------------------------- */

    async navigateToLogin() {
        await this.page.goto("/login");
        await this.page.waitForLoadState("networkidle");
        await this.page.waitForURL("/login");
    }

    async clickLogin() {
        await this.page
            .locator("button", { hasText: "Recover your wallet" })
            .click();
    }

    async verifyLoginReady() {
        await expect(this.page).toHaveURL("/login");
        // Verify the button is visible
        const hasButton = await this.page
            .locator("button", { hasText: "Recover your wallet" })
            .isVisible();
        expect(hasButton).toBeTruthy();
    }

    async verifyLoginError() {
        const hasError = await this.page
            .locator("div", { hasText: "No wallet found" })
            .isVisible({ timeout: 2_000 });
        expect(hasError).toBeTruthy();
    }

    /* -------------------------------------------------------------------------- */
    /*                                   Pairing                                  */
    /* -------------------------------------------------------------------------- */

    async clickPairing() {
        await this.page
            .locator("button", {
                hasText: "Use QR code to connect",
            })
            .click();
    }

    async verifyPairingReady() {
        // Verify the confirmation code is displayed
        await expect(
            this.page.getByText("Check that the code is correct")
        ).toBeVisible();
        // Verify that the qr code is displayed
        const qrCode = this.page
            .locator('button:has(svg title:text("QR Code"))')
            .first();
        await expect(qrCode).toBeVisible();
    }

    /* -------------------------------------------------------------------------- */
    /*                                   Success                                  */
    /* -------------------------------------------------------------------------- */

    async verifyWalletPage() {
        // Wait for the path to be /wallet
        await this.page.waitForURL("/wallet");

        // Ensure we are on the right page
        await expect(this.page).toHaveURL("/wallet");

        // Ensure we got a big text with `Balance`
        await expect(
            this.page.locator("span", { hasText: "Balance" })
        ).toBeVisible();
    }
}
