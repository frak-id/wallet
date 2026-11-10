import type { RewardSummary } from "@frak-labs/core-sdk";
import { sdkConfigStore } from "@frak-labs/core-sdk";
import { getRewardSummary } from "@frak-labs/core-sdk/actions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountRewardReminder } from "./mountRewardReminder";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";

function amounts(eur: number) {
    return { eurAmount: eur, usdAmount: eur, gbpAmount: eur };
}

const PENDING: RewardSummary = {
    linked: false,
    pending: {
        total: amounts(5),
        cashback: amounts(5),
        fromFriends: amounts(0),
        count: 1,
        lockedCount: 0,
        nextUnlockAt: null,
        expiresAt: null,
    },
    earned: null,
};

describe("mountRewardReminder", () => {
    beforeEach(() => {
        sdkConfigStore.setConfig({ isResolved: true, merchantId: MERCHANT_ID });
        vi.mocked(getRewardSummary).mockResolvedValue(PENDING);
        document.body.innerHTML = "";
    });

    afterEach(() => {
        sdkConfigStore.clearCache();
        window.__frakSdkConfig = undefined;
    });

    const mounted = () => document.querySelectorAll("frak-reward-reminder");

    it("appends one reminder for a visitor with rewards to claim", async () => {
        await mountRewardReminder();

        expect(mounted()).toHaveLength(1);
        expect(mounted()[0].parentElement).toBe(document.body);
    });

    it("does not append a second one", async () => {
        await mountRewardReminder();
        await mountRewardReminder();

        expect(mounted()).toHaveLength(1);
    });

    it("leaves a reminder the merchant placed alone", async () => {
        document.body.append(document.createElement("frak-reward-reminder"));

        await mountRewardReminder();

        expect(mounted()).toHaveLength(1);
        expect(getRewardSummary).not.toHaveBeenCalled();
    });

    it("mounts nothing when nothing is waiting", async () => {
        vi.mocked(getRewardSummary).mockResolvedValue({
            linked: false,
            pending: null,
            earned: null,
        });

        await mountRewardReminder();

        expect(mounted()).toHaveLength(0);
    });

    it("mounts nothing for a linked visitor", async () => {
        vi.mocked(getRewardSummary).mockResolvedValue({
            ...PENDING,
            linked: true,
        });

        await mountRewardReminder();

        expect(mounted()).toHaveLength(0);
    });

    it("mounts nothing when the summary fails", async () => {
        vi.mocked(getRewardSummary).mockResolvedValue(null);

        await mountRewardReminder();

        expect(mounted()).toHaveLength(0);
    });

    it("mounts nothing once dismissed this session", async () => {
        sessionStorage.setItem(
            `frak-reward-reminder-dismissed-${MERCHANT_ID}`,
            "1"
        );

        await mountRewardReminder();

        expect(mounted()).toHaveLength(0);
        expect(getRewardSummary).not.toHaveBeenCalled();
    });
});
