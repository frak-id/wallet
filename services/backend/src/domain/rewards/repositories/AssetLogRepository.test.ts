import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateAssetLogParams } from "../types";
import { AssetLogRepository } from "./AssetLogRepository";

const NOW = new Date("2026-07-10T21:35:17.357Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const baseParams: CreateAssetLogParams = {
    identityGroupId: "group-1",
    merchantId: "merchant-1",
    campaignRuleId: "campaign-1",
    assetType: "token",
    amount: 30,
    recipientType: "referrer",
    interactionLogId: "interaction-1",
};

function buildOne(overrides: Partial<CreateAssetLogParams> = {}) {
    const [row] = new AssetLogRepository().buildInserts([
        { ...baseParams, ...overrides },
    ]);
    return row;
}

describe("AssetLogRepository.buildInserts", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("expires 90 days after creation when there is no lockup", () => {
        const row = buildOne();

        expect(row.availableAt).toBeNull();
        expect(row.expiresAt).toEqual(new Date(NOW.getTime() + 90 * DAY_MS));
    });

    it("starts the claim window when the lockup ends", () => {
        const row = buildOne({ lockupSeconds: 60 * 86_400 });

        expect(row.availableAt).toEqual(new Date(NOW.getTime() + 60 * DAY_MS));
        expect(row.expiresAt).toEqual(
            new Date(NOW.getTime() + (60 + 90) * DAY_MS)
        );
    });

    it("applies the campaign claim window after the lockup", () => {
        const row = buildOne({
            lockupSeconds: 14 * 86_400,
            expirationDays: 30,
        });

        expect(row.expiresAt).toEqual(
            new Date(NOW.getTime() + (14 + 30) * DAY_MS)
        );
    });

    it("falls back to the default window for a non-positive expirationDays", () => {
        const row = buildOne({ lockupSeconds: 86_400, expirationDays: 0 });

        expect(row.expiresAt).toEqual(
            new Date(NOW.getTime() + (1 + 90) * DAY_MS)
        );
    });
});
