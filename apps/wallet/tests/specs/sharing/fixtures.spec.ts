import { FrakContextManager } from "@frak-labs/core-sdk";
import { TARGET_HOST_URL } from "../../../playwright.config";
import { expect, test } from "../../fixtures";
import { createReferee } from "../../helpers/referee.helper";
import { createReferrer } from "../../helpers/referrer.helper";
import { assertStackReady } from "../../helpers/stack.helper";

test.describe("sharing referral fixtures", () => {
    test("the environment satisfies every precondition", async () => {
        const merchant = await assertStackReady();
        expect(merchant.merchantId).toBeTruthy();
    });

    test("a referrer produces a link naming its own wallet", async ({
        referrer,
    }) => {
        const merchant = await assertStackReady();
        const wallet = referrer.walletAddress();

        const link = await referrer.captureSharingLink();
        const context = FrakContextManager.parse({ url: link });

        if (!context || !("v" in context) || context.v !== 2) {
            throw new Error(
                `Share link carries no v2 Frak context: ${link} (${JSON.stringify(context)})`
            );
        }
        // Without `w` the link is anonymous — every downstream arrival
        // assertion would pass while attributing to nobody.
        expect(context.w?.toLowerCase()).toBe(wallet.toLowerCase());
        expect(context.m).toBe(merchant.merchantId);
    });

    test("two credential contexts are two distinct wallets", async ({
        browser,
    }) => {
        await assertStackReady();
        const first = await browser.newContext();
        const second = await browser.newContext();
        try {
            const referrerA = await createReferrer(first, "referrer");
            const referrerB = await createReferrer(second, "referrer-second");
            expect(referrerA.walletAddress()).not.toBe(
                referrerB.walletAddress()
            );
        } finally {
            await first.close();
            await second.close();
        }
    });

    test("each referee is a fresh anonymous identity", async ({
        browser,
        referee,
    }) => {
        await assertStackReady();
        await referee.arriveOn(TARGET_HOST_URL);
        const first = await referee.clientId();
        expect(first).toBeTruthy();

        const other = await createReferee(browser);
        try {
            await other.arriveOn(TARGET_HOST_URL);
            expect(await other.clientId()).not.toBe(first);
        } finally {
            await other.close();
        }
    });

    test("the referee context shares no storage with the referrer", async ({
        referrer,
        referee,
    }) => {
        await assertStackReady();
        await referee.arriveOn(TARGET_HOST_URL);

        const refereeSession = await referee.page.evaluate(() =>
            localStorage.getItem("frak_session_store")
        );
        expect(refereeSession).toBeNull();
        expect(referrer.walletAddress()).toBeTruthy();
    });
});
