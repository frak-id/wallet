import { ReferralApi } from "../../api/referral.api";
import { expect, test } from "../../fixtures";
import { createReferrer } from "../../helpers/referrer.helper";
import { assertStackReady } from "../../helpers/stack.helper";

/**
 * Attribution rules. Both tests assert an absence, so both depend on
 * `referral-earned` having run first in this worker and proven the environment
 * emits arrivals at all — the file name orders them, the project is serial.
 */

test("a referrer opening their own link earns nothing", async ({
    referrer,
}) => {
    const merchant = await assertStackReady();
    const referralApi = new ReferralApi(referrer.page);
    await referralApi.captureArrivals();

    const link = await referrer.captureSharingLink();
    await referrer.openMerchantPage(link);

    // Observe the SDK's own verdict, not just the absence of a request: a
    // refused interaction and a self-referral both emit nothing, and only this
    // distinguishes them.
    const verdict = await referrer.page.evaluate(async () => {
        const core = window.FrakSetup?.core;
        const client = window.FrakSetup?.client;
        if (!core || !client) throw new Error("SDK not booted");
        return core.referralInteraction(client);
    });
    expect(verdict).toBe("self-referral");

    expect(referralApi.captured()).toHaveLength(0);

    const clientId = await referrer.page.evaluate(async () => {
        const core = window.FrakSetup?.core;
        if (!core) throw new Error("SDK not booted");
        return core.getClientIdAsync();
    });
    const status = await referralApi.readReferralStatus(merchant.merchantId, {
        "x-frak-client-id": clientId,
    });
    expect(status.isReferred).toBe(false);
});

test("the first referrer keeps the attribution", async ({
    browser,
    referrer,
    referee,
}) => {
    const merchant = await assertStackReady();
    const referralApi = new ReferralApi(referee.page);
    await referralApi.captureArrivals();

    const secondContext = await browser.newContext();
    try {
        const second = await createReferrer(secondContext, "referrer-second");

        // Asserted before the arrivals so a credential collision fails as
        // itself rather than as a confusing first-referrer-wins result.
        expect(referrer.walletAddress()).not.toBe(second.walletAddress());

        const firstLink = await referrer.captureSharingLink();
        const secondLink = await second.captureSharingLink();

        await referee.arriveOn(firstLink);
        const [firstArrival] = await referralApi.waitForArrivals(1);
        expect(firstArrival.referralLinkId).toBeTruthy();

        await referee.arriveOn(secondLink);
        const arrivals = await referralApi.waitForArrivals(2);
        expect(arrivals[1].referralLinkId).toBeFalsy();

        const clientId = await referee.clientId();
        const status = await referralApi.readReferralStatus(
            merchant.merchantId,
            { "x-frak-client-id": clientId }
        );
        expect(status.isReferred).toBe(true);
    } finally {
        await secondContext.close();
    }
});
