import { FrakContextManager } from "@frak-labs/core-sdk";
import { ReferralApi } from "../../api/referral.api";
import { expect, test } from "../../fixtures";
import { assertStackReady } from "../../helpers/stack.helper";

/**
 * The positive control for the whole suite: it is the one spec that proves an
 * arrival from this environment reaches the backend and becomes an
 * attribution. Every "no attribution" assertion elsewhere is only meaningful
 * once this has passed.
 */
test("a referee arriving on a share link is recorded as referred", async ({
    referrer,
    referee,
}) => {
    const merchant = await assertStackReady();
    const referralApi = new ReferralApi(referee.page);
    await referralApi.captureArrivals();

    const link = await referrer.captureSharingLink();

    // Assert the link before using it: one that lost its `w` still produces a
    // valid-looking arrival, just an unattributed one, so a weaker assertion
    // downstream would pass while proving nothing.
    const context = FrakContextManager.parse({ url: link });
    if (!context || !("v" in context) || context.v !== 2) {
        throw new Error(`Share link carries no v2 Frak context: ${link}`);
    }
    expect(context.w?.toLowerCase()).toBe(
        referrer.walletAddress().toLowerCase()
    );
    expect(context.m).toBe(merchant.merchantId);

    await referee.arriveOn(link);
    const clientId = await referee.clientId();

    const [arrival] = await referralApi.waitForArrivals(1);
    expect(
        arrival.referralLinkId,
        `arrival created no attribution: ${JSON.stringify(arrival)}`
    ).toBeTruthy();

    const status = await referralApi.readReferralStatus(merchant.merchantId, {
        "x-frak-client-id": clientId,
    });
    expect(status.isReferred).toBe(true);
});
