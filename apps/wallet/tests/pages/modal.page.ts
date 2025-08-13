import {
    type Frame,
    type FrameLocator,
    type Page,
    expect,
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
        await expect(this.walletFrame.locator("body")).toBeVisible();
    }

    async verifyModalNotDisplayed() {
        await expect(this.walletFrame.locator("body")).not.toBeVisible();
    }

    async verifyActivatedButton() {
        await expect(this.walletFrame.getByText("Activated")).toBeVisible();
    }

    async verifyDesactivatedButton() {
        await expect(this.walletFrame.getByText("Disabled")).toBeVisible();
    }

    async clickActivatedButton() {
        await this.walletFrame.getByRole("button", { name: "Power" }).click();
    }
    async clickDesactivatedButton() {
        await this.walletFrame.getByRole("button", { name: "Power" }).click();
    }

    async verifyDisableCopyAndShareButton() {
        await expect(
            this.walletFrame.getByRole("button", { name: "Copy" })
        ).toBeDisabled();
        await expect(
            this.walletFrame.getByRole("button", { name: "Share" })
        ).toBeDisabled();
    }

    async verifyEnableCopyAndShareButton() {
        await expect(
            this.walletFrame.getByRole("button", { name: "Copy" })
        ).toBeEnabled();
        await expect(
            this.walletFrame.getByRole("button", { name: "Share" })
        ).toBeEnabled();
    }

    async clickShareButton() {
        await expect(
            this.walletFrame.getByRole("button", { name: "Share" })
        ).toBeVisible();
        await this.walletFrame.getByRole("button", { name: "Share" }).click();
    }

    async clickCopyButton() {
        await expect(
            this.walletFrame.getByRole("button", { name: "Copy" })
        ).toBeVisible();
        await this.walletFrame.getByRole("button", { name: "Copy" }).click();
    }

    // Verify balance informations
    async verifyBalanceInformations(amount: number) {
        await expect(this.walletFrame.getByText("Balance")).toBeVisible();
        await expect(
            this.walletFrame.getByText(amount.toString())
        ).toBeVisible();
    }

    // VerifyPendingInformation
    async verifyPendingInformations(amount: number) {
        await expect(this.walletFrame.getByText("Pending")).toBeVisible();
        await expect(
            this.walletFrame.getByText(amount.toString())
        ).toBeVisible();
    }
}
