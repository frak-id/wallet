import { type FrameLocator, type Page, expect } from "@playwright/test";

export class ModalPage {
    constructor(private readonly page: Page) {}

    /**
     * Get the iframe locator of the Frak client
     */
    get walletFrame(): FrameLocator {
        return this.page.frameLocator("#frak-wallet");
    }

    async verifyModalDisplayed() {
        await expect(this.walletFrame.locator("body")).toBeVisible();
    }

    async verifyModalNotDisplayed() {
        await expect(this.walletFrame.locator("body")).not.toBeVisible();
    }
}
