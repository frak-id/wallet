import {
    type BrowserContext,
    type Page,
    type PageScreenshotOptions,
    expect,
} from "@playwright/test";
import { PairingPage } from "tests/pages/pairing.page";
import { MockedWebAuthNHelper } from "./mockedWebauthn.helper";
import { loadFrakStorageState } from "./utils";

/**
 * Helper class for managing a pairing tab in tests
 * This provides a separate browser tab that can be used for pairing operations
 */
export class PairingTabHelper {
    private rawPairingPage: Page | null = null;
    private pairingPage: PairingPage | null = null;
    private mockedWebauthN: MockedWebAuthNHelper | null = null;
    private context: BrowserContext;

    constructor(context: BrowserContext) {
        this.context = context;
    }

    /**
     * Get the pairing tab page
     */
    get page(): PairingPage {
        if (!this.pairingPage) {
            throw new Error("Pairing tab not initialized. Call setup() first.");
        }
        return this.pairingPage;
    }

    /**
     * Setup the pairing tab
     */
    async setup(): Promise<void> {
        if (this.rawPairingPage) return;

        // Create a new page (tab) in the same context
        this.rawPairingPage = await this.context.newPage();

        // Create a mocked WebAuthN helper for this tab
        this.mockedWebauthN = new MockedWebAuthNHelper(this.rawPairingPage, {
            context: "pairing",
        });
        await this.mockedWebauthN.setup();

        // Create a PairingPage instance for this tab
        this.pairingPage = new PairingPage(this.rawPairingPage);

        this.rawPairingPage.goto("/");
        await this.rawPairingPage.waitForLoadState("networkidle");

        // Load the storage state for the pairing tab
        await loadFrakStorageState(this.rawPairingPage);
    }

    /**
     * Close the pairing tab
     */
    async close(): Promise<void> {
        if (this.rawPairingPage) {
            await this.rawPairingPage.close();
            this.pairingPage = null;
        }
    }

    /**
     * Take a screenshot of the pairing tab
     */
    async screenshot(options?: PageScreenshotOptions): Promise<Buffer> {
        if (!this.rawPairingPage) {
            throw new Error("Pairing tab not initialized. Call setup() first.");
        }

        return await this.rawPairingPage.screenshot(options);
    }

    /**
     * Method used to confirm pairing with a specific pairing ID
     * @param pairingId
     */
    async confirmPairing(
        pairingId: string,
        pairingCode?: string
    ): Promise<void> {
        if (!this.pairingPage || !this.rawPairingPage) {
            throw new Error(
                "Pairing page not initialized. Call setup() first."
            );
        }

        // Load the storage state for the pairing tab
        await loadFrakStorageState(this.rawPairingPage);

        await this.pairingPage.navigateToPairing(pairingId);
        await this.pairingPage.verifyPairingReady(pairingCode);
        await this.pairingPage.clickConfirm();
    }

    /**
     * Method used to confirm pairing with a specific pairing ID
     * @param pairingId
     */
    async rejectPairing(pairingId: string): Promise<void> {
        if (!this.pairingPage) {
            throw new Error(
                "Pairing page not initialized. Call setup() first."
            );
        }

        await this.pairingPage.navigateToPairing(pairingId);
        await this.pairingPage.verifyPairingReady();
        await this.pairingPage.clickCancel();
    }

    async acceptSignatureRequest(): Promise<void> {
        if (!this.rawPairingPage) {
            throw new Error(
                "Pairing page not initialized. Call setup() first."
            );
        }

        await expect(
            this.rawPairingPage
                .getByText(
                    "A device Chrome on Windows is requesting your signature"
                )
                .first()
        ).toBeVisible();
        await this.rawPairingPage
            .getByRole("button", { name: "Sign" })
            .first()
            .click();
    }

    async rejectSignatureRequest(): Promise<void> {
        if (!this.rawPairingPage) {
            throw new Error(
                "Pairing page not initialized. Call setup() first."
            );
        }

        await expect(
            this.rawPairingPage
                .getByText(
                    "A device Chrome on Windows is requesting your signature"
                )
                .first()
        ).toBeVisible();
        await this.rawPairingPage
            .getByRole("button", { name: "Reject" })
            .first()
            .click();
    }
}
