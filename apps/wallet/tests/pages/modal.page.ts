import {
    type ElementHandle,
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

    // Login step with `allowSso: false` → primary action is the passkey
    // button. Its node handle is captured pre-click so the advance wait can
    // anchor on the login step actually unmounting — the next step's primary
    // reuses the same class, so the locator alone can't observe a transition.
    private loginPrimaryHandle: ElementHandle | null = null;

    async clickLoginPasskey() {
        const passkey = this.primaryButton.first();
        await expect(passkey).toBeVisible();
        this.loginPrimaryHandle = await passkey.elementHandle();
        await passkey.click();
    }

    // The mocked login resolves and the modal advances: the captured login
    // button detaches, then the next step mounts its own primary. Throws on
    // misuse instead of degrading to a racy visibility check — a missing
    // handle would make this a silently-passing gate again.
    async waitForLoginToAdvance() {
        const handle = this.loginPrimaryHandle;
        if (!handle) {
            throw new Error(
                "clickLoginPasskey() must run before waitForLoginToAdvance()"
            );
        }
        await handle.waitForElementState("hidden");
        this.loginPrimaryHandle = null;
        await expect(this.primaryButton.first()).toBeVisible();
    }

    // sendTransaction step → primary action is "Send".
    async verifyTransactionStep() {
        await expect(this.primaryButton.first()).toBeVisible();
    }

    async clickSendTransaction() {
        await this.clickPrimary();
    }
}
