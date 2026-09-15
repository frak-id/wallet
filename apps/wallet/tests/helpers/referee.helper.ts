import type { Browser, BrowserContext, Page } from "@playwright/test";
import { SdkHelper } from "./sdk.helper";

/**
 * An anonymous visitor consuming a share link.
 *
 * Owns its own browser context, so it shares no storage, cookies or credential
 * with the referrer — and mints a new anonymous identity on every run, which is
 * what makes a repeated run create a genuinely new attribution edge instead of
 * re-reading the previous one.
 */
export class RefereeHelper {
    readonly page: Page;
    readonly sdk: SdkHelper;

    constructor(
        readonly context: BrowserContext,
        page: Page
    ) {
        this.page = page;
        this.sdk = new SdkHelper(page);
    }

    /** Open a share link on the merchant page and let the SDK process it. */
    async arriveOn(sharingLink: string) {
        await this.sdk.init(sharingLink);
    }

    /**
     * The SDK's derived anonymous id — the identity every arrival and every
     * anonymous referral-status read is attributed to.
     */
    async clientId(): Promise<string> {
        return this.page.evaluate(async () => {
            const core = window.FrakSetup?.core;
            if (!core) {
                throw new Error("FrakSetup.core unavailable on the page");
            }
            return core.getClientIdAsync();
        });
    }

    async close() {
        await this.context.close();
    }
}

/** A referee in a brand-new context — empty storage, no authenticator. */
export async function createReferee(browser: Browser): Promise<RefereeHelper> {
    const context = await browser.newContext({
        permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    return new RefereeHelper(context, page);
}
