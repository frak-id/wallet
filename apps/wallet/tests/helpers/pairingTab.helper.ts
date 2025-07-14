import type {
    BrowserContext,
    Page,
    PageScreenshotOptions,
} from "@playwright/test";
import { MockedWebAuthNHelper } from "./mockedWebauthn.helper";

/**
 * Helper class for managing a pairing tab in tests
 * This provides a separate browser tab that can be used for pairing operations
 */
export class PairingTabHelper {
    private pairingPage: Page | null = null;
    private mockedWebauthN: MockedWebAuthNHelper | null = null;
    private context: BrowserContext;

    constructor(context: BrowserContext) {
        this.context = context;
    }

    /**
     * Get the pairing tab page
     */
    get page(): Page {
        if (!this.pairingPage) {
            throw new Error("Pairing tab not initialized. Call setup() first.");
        }
        return this.pairingPage;
    }

    /**
     * Setup the pairing tab
     */
    async setup(): Promise<void> {
        // Create a new page (tab) in the same context
        this.pairingPage = await this.context.newPage();

        // Create a mocked WebAuthN helper for this tab
        this.mockedWebauthN = new MockedWebAuthNHelper(this.pairingPage);
        await this.mockedWebauthN.setup();

        // Navigate to the wallet base URL
        await this.pairingPage.goto("/");
    }

    /**
     * Navigate to the pairing page with a specific pairing ID
     */
    async navigateToPairing(pairingId: string): Promise<void> {
        if (!this.pairingPage) {
            throw new Error("Pairing tab not initialized. Call setup() first.");
        }

        await this.pairingPage.goto(`/pairing?id=${pairingId}`);
    }

    /**
     * Close the pairing tab
     */
    async close(): Promise<void> {
        if (this.pairingPage) {
            await this.pairingPage.close();
            this.pairingPage = null;
        }
    }

    /**
     * Take a screenshot of the pairing tab
     */
    async screenshot(options?: PageScreenshotOptions): Promise<Buffer> {
        if (!this.pairingPage) {
            throw new Error("Pairing tab not initialized. Call setup() first.");
        }

        return await this.pairingPage.screenshot(options);
    }
}
