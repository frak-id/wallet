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
        // Email step: submit a unique address so it resolves as a new email.
        await this.submitOnboardingEmail();
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

    // The email-availability check is flaky locally (Continue stays disabled,
    // or errors transiently); retry with a fresh address. 2 attempts fits the
    // 60s per-test budget (~15s enable + ~10s keypass each).
    private async submitOnboardingEmail() {
        // textbox role (exact): getByLabel("Email") also matches the clear button.
        const emailInput = this.page.getByRole("textbox", {
            name: "Email",
            exact: true,
        });
        const emailContinue = this.page.getByRole("button", {
            name: "Continue",
        });
        const keypassButton = this.page.locator("button", {
            hasText: "Activate my secure space",
        });
        const errorAlert = this.page.getByText(
            "Unable to verify this email right now"
        );

        for (let attempt = 0; attempt < 2; attempt++) {
            await emailInput.fill(`e2e-${Date.now()}-${attempt}@frak.test`);
            // Wait for enable rather than clicking a disabled button.
            await expect(emailContinue).toBeEnabled({ timeout: 15_000 });
            await emailContinue.click();

            // Advances (keypass) or errors (alert) — race the two.
            try {
                await expect(keypassButton).toBeVisible({ timeout: 10_000 });
                return;
            } catch {
                if (await errorAlert.isVisible()) {
                    // Transient backend error — retry with a new address.
                    continue;
                }
                throw new Error(
                    "Email onboarding step did not advance and no error alert was shown"
                );
            }
        }
        throw new Error(
            "Email onboarding step failed to advance after 2 attempts"
        );
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
        // No reliable error UI here, so assert the negative outcome. Settle
        // first so a mid-transition state can't pass before registration fails,
        // then confirm we stayed in /register and never reached the wallet.
        await this.page.waitForTimeout(2_000);
        await expect(this.page).toHaveURL(/\/register/);
        await expect(
            this.page.getByRole("heading", { name: "Wallet", level: 1 })
        ).not.toBeVisible();
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
        // `goto` awaits "load"; avoid `networkidle` (never settles here).
        await this.page.goto("/login");
        await this.page.waitForURL("/login");
    }

    async clickLogin() {
        await this.page
            .locator("button", { hasText: "Use biometrics" })
            .click();
    }

    async verifyLoginReady() {
        await expect(this.page).toHaveURL("/login");
        // Auto-waiting assertion (not a one-shot `isVisible()`) so SPA render
        // timing doesn't make this flaky.
        await expect(
            this.page.locator("button", { hasText: "Use biometrics" })
        ).toBeVisible();
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
        await expect(this.page.getByText("Pairing in progress")).toBeVisible({
            timeout: 10_000,
        });
        // Verify the QR code is displayed
        await expect(
            this.page.getByRole("button", { name: "QR Code" }).first()
        ).toBeVisible();
    }

    /**
     * Read the pairing id + code from the page. The pairing WebSocket is not
     * observable from Playwright, and the id only feeds the QR pattern, so both
     * are exposed via `data-pairing-*` attributes on the QR button.
     */
    async getPairingInfo(): Promise<{
        pairingId: string;
        pairingCode: string;
    }> {
        const qr = this.page.locator("[data-pairing-id]");
        // Both attributes are populated together with the pairing-initiated
        // message; wait for the code so we don't read a half-rendered state.
        await expect(qr).toHaveAttribute("data-pairing-code", /.+/, {
            timeout: 10_000,
        });
        const pairingId = await qr.getAttribute("data-pairing-id");
        const pairingCode = await qr.getAttribute("data-pairing-code");
        if (!pairingId || !pairingCode) {
            throw new Error("Pairing id/code not present on the QR element");
        }
        return { pairingId, pairingCode };
    }

    /* -------------------------------------------------------------------------- */
    /*                                   Success                                  */
    /* -------------------------------------------------------------------------- */

    async verifyWalletPage() {
        // Wait for the path to be /wallet
        await this.page.waitForURL("/wallet");

        // Ensure we are on the right page
        await expect(this.page).toHaveURL("/wallet");

        // Ensure the wallet home rendered (the "Wallet" page heading).
        await expect(
            this.page.getByRole("heading", { name: "Wallet", level: 1 })
        ).toBeVisible();
    }
}
