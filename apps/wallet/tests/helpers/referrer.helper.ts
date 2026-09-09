import type { BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { AuthPage } from "../pages/auth.page";
import { ClipboardHelper } from "./clipboard.helper";
import { MockedWebAuthNHelper } from "./mockedWebauthn.helper";
import { SdkHelper } from "./sdk.helper";

// Per attempt, not a total: a dropped login click never navigates, so a
// shorter budget with a re-click beats one long wait.
const LOGIN_ATTEMPTS = 3;
const LOGIN_TIMEOUT_MS = 12_000;
// Same shape for the sharing modal, whose open request is dropped just as
// `displayModal`'s is.
const MODAL_OPEN_ATTEMPTS = 3;
const MODAL_OPEN_TIMEOUT_MS = 8_000;

/**
 * A registered wallet that can produce share links from the merchant page.
 *
 * Each referrer owns a named credential file, so two referrers in one run are
 * two distinct wallets and the same name across runs is the same wallet —
 * registration against the real backend is the flakiest step in the suite and
 * is not worth repeating per spec.
 */
export class ReferrerHelper {
    readonly page: Page;
    private readonly auth: AuthPage;
    private readonly sdk: SdkHelper;
    private readonly clipboard: ClipboardHelper;
    private readonly webAuthN: MockedWebAuthNHelper;
    private address?: string;

    constructor(
        page: Page,
        private readonly credentialContext: string
    ) {
        this.page = page;
        this.auth = new AuthPage(page);
        this.sdk = new SdkHelper(page);
        this.clipboard = new ClipboardHelper(page);
        this.webAuthN = new MockedWebAuthNHelper(page, {
            context: credentialContext,
        });
    }

    /**
     * Register (or log back into) this referrer's wallet on the wallet origin.
     *
     * The listener modal has no register path, so registration must happen
     * here; the listener then sees the session because it is served under the
     * same origin and shares `frak_session_store`.
     *
     * Which branch to take comes from the authenticator, not from a login
     * timeout: a slow-but-valid login would otherwise be read as "no wallet"
     * and send an already-registered credential through registration, where
     * it fails on the duplicate-wallet screen.
     */
    async authenticate() {
        await this.webAuthN.setup();

        if (this.webAuthN.isFreshCredential) {
            await this.auth.navigateToRegister();
            await this.auth.verifyRegistrationReady();
            await this.auth.clickRegister();
            await this.auth.completeOnboarding();
        } else {
            await this.login();
        }

        this.address = await this.readWalletAddress();
    }

    // The login click is occasionally dropped without navigating — the same
    // race `SdkHelper.fireUntilModalOpen` absorbs for the modal. Re-click
    // rather than wait longer: a dropped click never resolves.
    private async login() {
        for (let attempt = 0; attempt < LOGIN_ATTEMPTS; attempt++) {
            await this.auth.navigateToLogin();
            await this.auth.verifyLoginReady();
            await this.auth.clickLogin();
            try {
                await this.page.waitForURL("/wallet", {
                    timeout: LOGIN_TIMEOUT_MS,
                });
                return;
            } catch {
                // Not on the wallet within the budget — re-fire.
            }
        }
        throw new Error(
            `[referrer:${this.credentialContext}] login never reached /wallet after ${LOGIN_ATTEMPTS} attempts`
        );
    }

    /**
     * The wallet address this referrer's links will carry.
     *
     * Read once, while the page is still on the wallet origin: after
     * `openMerchantPage` the top-level document is the merchant's, whose
     * `localStorage` is a different origin's and holds no session.
     */
    private async readWalletAddress(): Promise<string> {
        const address = await this.page.evaluate(() => {
            const raw = localStorage.getItem("frak_session_store");
            if (!raw) return undefined;
            // Same shape `getSafeSession` reads (wallet-shared
            // `common/utils/safeSession.ts`) — the zustand persist envelope.
            const parsed = JSON.parse(raw) as {
                state?: { session?: { address?: string } };
            };
            return parsed.state?.session?.address;
        });
        if (!address) {
            throw new Error(
                `[referrer:${this.credentialContext}] no wallet session on ${this.page.url()} after authenticate()`
            );
        }
        return address;
    }

    /** The wallet address the listener signs this referrer's links with. */
    walletAddress(): string {
        if (!this.address) {
            throw new Error(
                `[referrer:${this.credentialContext}] authenticate() has not run`
            );
        }
        return this.address;
    }

    /** Drop the persisted credential — for a per-run context. */
    forgetCredential() {
        this.webAuthN.forgetCredential();
    }

    /** Boot the SDK on the merchant page this referrer will share from. */
    async openMerchantPage(hostUrl?: string) {
        await this.sdk.init(hostUrl);
    }

    /**
     * Open the sharing modal and copy its link.
     *
     * Copy, never share: `canShare` is false on Desktop Chrome, so the Share
     * button never renders and there is no `navigator.share` to intercept.
     */
    async captureSharingLink(): Promise<string> {
        const frame = this.page.frameLocator("#frak-wallet");
        const copyButton = frame.getByTestId("sharing-copy");

        // The SDK occasionally drops the first open request, exactly as
        // `SdkHelper.fireUntilModalOpen` documents for `displayModal` — a
        // dropped one never resolves, so re-fire rather than wait longer.
        for (let attempt = 0; attempt < MODAL_OPEN_ATTEMPTS; attempt++) {
            const client = await this.sdk.walletClient;
            // Not awaited: the RPC settles only when the user acts on the
            // modal, which is the click below. Swallow the rejection so a
            // superseded request is not an unhandled one.
            await client.evaluate((c) => {
                c.request({
                    method: "frak_displaySharingPage",
                    params: [{}, c.config.metadata],
                }).catch(() => {});
            });

            try {
                await expect(copyButton).toBeVisible({
                    timeout: MODAL_OPEN_TIMEOUT_MS,
                });
                await copyButton.click();
                return this.clipboard.readText();
            } catch {
                // Not open yet — re-fire on the next attempt.
            }
        }

        // A rendered footer without the hook is a stale listener build, which
        // is a different failure from a modal that never opened at all.
        const footerRendered = await frame.locator("footer").count();
        throw new Error(
            footerRendered
                ? `[referrer:${this.credentialContext}] the sharing modal rendered but carries no [data-testid="sharing-copy"]. ` +
                      `The listener at ${this.page.url()} predates the U1 test hooks — deploy this branch, or run against a target that has it.`
                : `[referrer:${this.credentialContext}] the sharing modal never opened on ${this.page.url()} after ${MODAL_OPEN_ATTEMPTS} attempts.`
        );
    }
}

/**
 * Register a referrer and leave it booted on the merchant page, ready to
 * produce links.
 */
export async function createReferrer(
    context: BrowserContext,
    credentialContext: string,
    hostUrl?: string
): Promise<ReferrerHelper> {
    const page = await context.newPage();
    const referrer = new ReferrerHelper(page, credentialContext);
    await referrer.authenticate();
    await referrer.openMerchantPage(hostUrl);
    return referrer;
}
