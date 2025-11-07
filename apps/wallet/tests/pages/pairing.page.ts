import { expect, type Page } from "@playwright/test";

export class PairingPage {
    constructor(private readonly page: Page) {}

    /**
     * Navigate to the pairing page with a specific pairing ID
     */
    async navigateToPairing(pairingId: string): Promise<void> {
        await this.page.goto(`/pairing?id=${pairingId}`);
    }

    /**
     * Navigate to the pairing page with a specific pairing ID
     */
    async verifyPairingReady(code?: string): Promise<void> {
        await expect(
            this.page.getByText("Confirm device pairing")
        ).toBeVisible();
        await expect(this.page.getByText("Pairing information")).toBeVisible();
        await expect(
            this.page.getByText("Check that the code is correct")
        ).toBeVisible();
        await expect(
            this.page.getByRole("button", { name: "Confirm" })
        ).toBeVisible();
        await expect(
            this.page.getByRole("button", { name: "Cancel" })
        ).toBeVisible();

        if (code) {
            await expect(this.page.getByText(`${code}`)).toBeVisible();
        }
    }

    async clickConfirm() {
        await this.page.getByRole("button", { name: "Confirm" }).click();
    }

    async clickCancel() {
        await this.page.getByRole("button", { name: "Cancel" }).click();
    }
}
