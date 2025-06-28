import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Authentication helper class for biometric wallet operations
 */
export class AuthHelper {
    constructor(private page: Page) {}

    /**
     * Navigate to the registration page
     */
    async navigateToRegister(): Promise<void> {
        await this.page.goto("/register");
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Navigate to the login page
     */
    async navigateToLogin(): Promise<void> {
        await this.page.goto("/login");
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Navigate to the wallet dashboard
     */
    async navigateToWallet(): Promise<void> {
        await this.page.goto("/wallet");
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Wait for authentication to complete and verify success
     */
    async waitForAuthSuccess(timeout = 15000): Promise<void> {
        // Wait for redirect to wallet or success indicators
        await Promise.race([
            this.page.waitForURL(/.*\/wallet.*/, { timeout }),
            this.page.waitForSelector("text=success", { timeout }),
        ]);
    }

    /**
     * Verify registration page is ready
     */
    async verifyRegistrationReady(): Promise<void> {
        // Wait for the Create your wallet button
        await this.page.waitForSelector(
            "button:has-text('Create your wallet')",
            { timeout: 10000 }
        );

        // Verify the button is visible
        const hasButton = await this.page
            .locator("button:has-text('Create your wallet')")
            .isVisible();
        expect(hasButton).toBeTruthy();
    }

    /**
     * Verify login page is ready
     */
    async verifyLoginReady(): Promise<void> {
        // Wait for the Recover your wallet button
        await this.page.waitForSelector(
            "button:has-text('Recover your wallet')",
            { timeout: 10000 }
        );

        // Verify the button is visible
        const hasButton = await this.page
            .locator("button:has-text('Recover your wallet')")
            .isVisible();
        expect(hasButton).toBeTruthy();
    }

    /**
     * Click the register wallet button
     */
    async clickRegister(): Promise<void> {
        await this.page.click("button:has-text('Create your wallet')");
    }

    /**
     * Click the login wallet button
     */
    async clickLogin(): Promise<void> {
        await this.page.click("button:has-text('Recover your wallet')");
    }

    /**
     * Verify wallet dashboard is accessible
     */
    async verifyWalletDashboard(): Promise<void> {
        // Wait for wallet page to load
        await this.page.waitForURL(/.*\/wallet.*/, { timeout: 15000 });

        // Wait for wallet components to load - try multiple indicators
        await Promise.race([
            this.page.waitForSelector('[class*="grid"]', { timeout: 10000 }),
            this.page.waitForSelector('[class*="balance"]', { timeout: 10000 }),
            this.page.waitForSelector("main", { timeout: 10000 }),
        ]);

        // Verify we're on the wallet page
        expect(this.page.url()).toContain("/wallet");
    }

    /**
     * Verify registration success
     */
    async verifyRegistrationSuccess(): Promise<void> {
        // For registration success, we expect to be redirected to wallet
        await this.page.waitForURL(/.*\/wallet.*/, { timeout: 15000 });
        expect(this.page.url()).toContain("/wallet");
    }

    /**
     * Check for authentication errors
     */
    async checkForAuthErrors(): Promise<string | null> {
        // Look for common error indicators in the UI
        const errorSelectors = [
            "text=error",
            "text=failed",
            "[class*='error']",
            "[class*='notice']",
        ];

        for (const selector of errorSelectors) {
            const errorElement = this.page.locator(selector);
            if (await errorElement.isVisible()) {
                return await errorElement.textContent();
            }
        }

        return null;
    }

    /**
     * Wait for page to load completely
     */
    async waitForPageLoad(): Promise<void> {
        await this.page.waitForLoadState("networkidle");
        // Additional wait for any dynamic content
        await this.page.waitForTimeout(1000);
    }

    /**
     * Clear browser storage for clean test state
     */
    async clearStorage(): Promise<void> {
        // Storage clearing is commented out in the current implementation
        // await this.page.evaluate(() => {
        //     localStorage.clear();
        //     sessionStorage.clear();
        // });
        // Clear IndexedDB if used by the wallet
        // await this.page.evaluate(() => {
        //     if (window.indexedDB) {
        //         // Delete common IndexedDB databases used by wallets
        //         const dbNames = ['frak-wallet', 'wallet-data', 'user-data'];
        //         return Promise.all(
        //             dbNames.map(name => {
        //                 return new Promise((resolve) => {
        //                     const deleteReq = window.indexedDB.deleteDatabase(name);
        //                     deleteReq.onsuccess = () => resolve(undefined);
        //                     deleteReq.onerror = () => resolve(undefined);
        //                     deleteReq.onblocked = () => resolve(undefined);
        //                 });
        //             })
        //         );
        //     }
        // });
    }

    /**
     * Take screenshot for debugging purposes
     */
    async captureScreenshot(name: string): Promise<void> {
        await this.page.screenshot({
            path: `test-results/screenshots/${name}-${Date.now()}.png`,
            fullPage: true,
        });
    }

    /**
     * Get current URL for verification
     */
    async getCurrentUrl(): Promise<string> {
        return this.page.url();
    }

    /**
     * Check if user is authenticated (wallet accessible)
     */
    async isAuthenticated(): Promise<boolean> {
        try {
            // Check if we're on a wallet page
            const currentUrl = this.page.url();
            if (currentUrl.includes("/wallet")) {
                // Verify wallet elements are actually present
                const hasWalletElements = await Promise.race([
                    this.page
                        .locator('[class*="grid"]')
                        .isVisible({ timeout: 3000 }),
                    this.page
                        .locator('[class*="balance"]')
                        .isVisible({ timeout: 3000 }),
                    this.page.locator("main").isVisible({ timeout: 3000 }),
                ]).catch(() => false);
                return hasWalletElements;
            }
            return false;
        } catch {
            return false;
        }
    }

    /**
     * Logout user (if logout functionality exists)
     */
    async logout(): Promise<void> {
        // Look for logout button or link
        const logoutSelectors = [
            "text=logout",
            "text=sign out",
            "[href*='logout']",
            "button[class*='logout']",
        ];

        for (const selector of logoutSelectors) {
            const logoutElement = this.page.locator(selector);
            if (await logoutElement.isVisible()) {
                await logoutElement.click();
                await this.page.waitForURL(/.*\/(login|register|home).*/, {
                    timeout: 10000,
                });
                return;
            }
        }
    }
}
