import type { Page } from "@playwright/test";
import { TARGET_BACKEND_URL } from "../../playwright.config";

/**
 * The arrival response, as `POST /user/track/interaction` returns it.
 *
 * `referralLinkId` is the only surface where first-referrer-wins is
 * observable: the read side reports `isReferred` and never names a referrer.
 */
export type ArrivalResponse = {
    identityGroupId: string;
    interactionLogId: string | null;
    isDuplicate: boolean;
    referralLinkId?: string | null;
};

/** Identity headers a referral-status read may carry. */
export type IdentityHeaders = {
    "x-frak-client-id"?: string;
    "x-wallet-sdk-auth"?: string;
};

export class ReferralApi {
    private readonly arrivals: ArrivalResponse[] = [];

    constructor(private readonly page: Page) {}

    /**
     * Record every arrival response without altering it.
     *
     * `route.fetch()` then `fulfill` with the same response — the established
     * interception pattern here. Nothing is mocked: only a real run proves the
     * `referral_links` row was written.
     *
     * Filtered on the request's `type`, because this one route also carries
     * `sharing` and `custom` interactions — the copy action alone posts a
     * `sharing` one. Their responses omit `referralLinkId` entirely, so an
     * unfiltered capture makes a self-referral look like an attributed
     * arrival that merely lost its id.
     */
    async captureArrivals() {
        await this.page.route("**/user/track/interaction", async (route) => {
            const isArrival =
                route.request().postDataJSON()?.type === "arrival";
            const response = await route.fetch();
            const body = await response.text();

            if (isArrival && response.status() === 200) {
                this.arrivals.push(JSON.parse(body) as ArrivalResponse);
            }

            await route.fulfill({
                response,
                body,
            });
        });
    }

    /** Arrival responses seen so far, oldest first. */
    captured(): ArrivalResponse[] {
        return [...this.arrivals];
    }

    /**
     * Wait until at least `count` arrivals have landed.
     *
     * Zero arrivals is the observable of a refused interaction, not of a
     * refused referral — both SDK layers swallow a trust-gate failure — so the
     * timeout message names that cause.
     */
    async waitForArrivals(
        count: number,
        timeoutMs = 15_000
    ): Promise<ArrivalResponse[]> {
        const deadline = Date.now() + timeoutMs;
        while (this.arrivals.length < count) {
            if (Date.now() > deadline) {
                throw new Error(
                    `Expected ${count} arrival request(s), saw ${this.arrivals.length} within ${timeoutMs}ms. ` +
                        "A refused interaction emits no request at all: check the listener trust level for this origin."
                );
            }
            await this.page.waitForTimeout(250);
        }
        return this.captured();
    }

    /**
     * Read referral status straight from the backend.
     *
     * Never through `frak_getUserReferralStatus`: that path is cached in the
     * SDK, in the listener query, and in `sessionStorage`, so a merge that
     * dropped the row would still read `isReferred: true`.
     *
     * Which headers go out is load-bearing. The backend builds an identity
     * node from every header present, so sending both resolves through
     * whichever group they share and proves nothing about a merge.
     */
    async readReferralStatus(
        merchantId: string,
        headers: IdentityHeaders
    ): Promise<{ isReferred: boolean }> {
        const result = await this.page.evaluate(
            async ({ backendUrl, merchantId, headers }) => {
                const response = await fetch(
                    `${backendUrl}/user/merchant/referral-status?merchantId=${encodeURIComponent(merchantId)}`,
                    { headers }
                );
                return { status: response.status, body: await response.text() };
            },
            { backendUrl: TARGET_BACKEND_URL, merchantId, headers }
        );

        if (result.status !== 200) {
            throw new Error(
                `referral-status returned ${result.status}: ${result.body}`
            );
        }
        return JSON.parse(result.body) as { isReferred: boolean };
    }
}
