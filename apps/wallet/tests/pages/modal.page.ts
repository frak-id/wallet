import {
    expect,
    type Frame,
    type FrameLocator,
    type Page,
} from "@playwright/test";

export class ModalPage {
    constructor(private readonly page: Page) {}

    /**
     * Get the iframe locator of the Frak client
     */
    get walletFrame(): FrameLocator {
        return this.page.frameLocator("#frak-wallet");
    }

    /**
     * Get the iframe of the Frak client
     */
    get frame(): Frame {
        const frame = this.page.frame("frak-wallet");
        if (!frame) {
            throw new Error("Frak wallet frame not found");
        }
        return frame;
    }

    async verifyModalDisplayed() {
        // The iframe <body> starts hidden and flips visible once content
        // mounts — allow time so we don't race the enter animation.
        await expect(this.walletFrame.locator("body")).toBeVisible({
            timeout: 15_000,
        });
    }

    async verifyModalNotDisplayed() {
        await expect(this.walletFrame.locator("body")).not.toBeVisible();
    }

    // --- Modal step helpers (redesigned listener modal) ------------------
    // All actions use the stable, language-independent `nexus-modal-*` class
    // hooks: the listener can render raw i18n keys before translations load,
    // so text-based selectors are unreliable.

    get primaryButton() {
        return this.walletFrame.locator(".nexus-modal-button-primary");
    }

    get secondaryButton() {
        return this.walletFrame.locator(".nexus-modal-button-secondary");
    }

    async clickPrimary() {
        await expect(this.primaryButton.first()).toBeVisible();
        await this.primaryButton.first().click();
    }

    async clickClose() {
        // The close button's aria-label is hardcoded (not i18n).
        const close = this.walletFrame.getByRole("button", { name: "Close" });
        await expect(close).toBeVisible();
        await close.click();
    }

    // Login step with `allowSso: false` → primary action is the passkey button.
    async clickLoginPasskey() {
        await this.clickPrimary();
    }

    // Once the login step completes, its secondary (QR) action disappears as
    // the modal advances to the next step.
    async waitForLoginToAdvance() {
        await expect(this.secondaryButton).toBeHidden();
    }

    // sendTransaction step → primary action is "Send".
    async verifyTransactionStep() {
        await expect(this.primaryButton.first()).toBeVisible();
    }

    async clickSendTransaction() {
        await this.clickPrimary();
    }
}
