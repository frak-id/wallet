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
        // The route normalises its search params (e.g. `?new=false`), so an
        // exact "/register" match never resolves — match loosely instead.
        await this.page.waitForURL(/\/register/);
    }

    /**
     * Navigate through onboarding slides to reach the Keypass step.
     * Does NOT trigger WebAuthn — use clickRegister() for full registration.
     */
    async navigateToKeypass() {
        // Slide 1 ("Earn money by recommending") → slide 2
        await this.page.locator("button", { hasText: "Get started" }).click();
        // Slide 2 → email input step
        await this.page.locator("button", { hasText: "Continue" }).click();
        // Email input step (added to the onboarding flow). A unique address
        // keeps the backend availability check resolving as a "new" email.
        await this.page.getByLabel("Email").fill(`e2e-${Date.now()}@frak.test`);
        await this.page.locator("button", { hasText: "Continue" }).click();
        // Slide 3 → "Activate my secure space" opens the Keypass modal
        await expect(
            this.page.locator("button", {
                hasText: "Activate my secure space",
            })
        ).toBeVisible({ timeout: 10_000 });
        await this.page
            .locator("button", { hasText: "Activate my secure space" })
            .click();
        // Keypass modal — the visible ContentBlock <h1>. (The Radix dialog
        // title renders a separate <h2> with the same text, so scope by level.)
        await expect(
            this.page.getByRole("heading", {
                name: "Secure your account",
                level: 1,
            })
        ).toBeVisible({ timeout: 5_000 });
    }

    /**
     * Onboarding inserts a referral-code step after WebAuthn registration.
     * Skip it when shown (it is absent for users with an existing referrer).
     */
    async skipReferralIfPresent() {
        const skip = this.page.locator("button", { hasText: "Skip" });
        try {
            await skip.waitFor({ state: "visible", timeout: 8_000 });
            await skip.click();
        } catch {
            // Referral step not shown — continue.
        }
    }

    /**
     * The notification opt-in step auto-skips once the permission is resolved;
     * otherwise dismiss it via "Later".
     */
    async skipNotificationIfPresent() {
        const later = this.page.locator("button", { hasText: "Later" });
        try {
            await later.waitFor({ state: "visible", timeout: 5_000 });
            await later.click();
        } catch {
            // Notification step auto-skipped — continue.
        }
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
        // The route normalises search params (`?new=false`), so match loosely.
        await expect(this.page).toHaveURL(/\/register/);
        // Verify the first onboarding slide is visible
        await expect(
            this.page.getByRole("heading", {
                name: "Earn money by recommending",
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
            .locator("button", { hasText: "Use biometrics" })
            .click();
    }

    async verifyLoginReady() {
        await expect(this.page).toHaveURL("/login");
        // Verify the button is visible
        const hasButton = await this.page
            .locator("button", { hasText: "Use biometrics" })
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
        // The keypass modal switches to the live pairing view with a status
        // line and the 6-digit confirmation code.
        await expect(
            this.page.getByText("Pairing in progress")
        ).toBeVisible({ timeout: 10_000 });
        // Verify the QR code is displayed
        await expect(
            this.page.getByRole("button", { name: "QR Code" }).first()
        ).toBeVisible();
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
