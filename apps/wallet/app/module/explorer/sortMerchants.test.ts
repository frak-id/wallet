import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { describe, expect, test } from "vitest";
import type { MerchantRewardSortValue } from "./explorerRewardSort";
import { sortMerchants } from "./sortMerchants";

function merchant(
    id: string,
    activeCampaignCount: number
): ExplorerMerchantItem {
    return {
        id,
        name: id,
        domain: `${id}.example`,
        explorerConfig: null,
        activeCampaignCount,
        integration: "native",
    };
}

const list = [merchant("a", 1), merchant("b", 3), merchant("c", 2)];

describe("sortMerchants", () => {
    test("popular orders by descending active campaign count", () => {
        expect(sortMerchants(list, "popular").map((m) => m.id)).toEqual([
            "b",
            "c",
            "a",
        ]);
    });

    test("recent reverses the fetched order (placeholder)", () => {
        expect(sortMerchants(list, "recent").map((m) => m.id)).toEqual([
            "c",
            "b",
            "a",
        ]);
    });

    // Without reward values, reward/expiring can't sort and keep input order.
    test("reward/expiring keep input order without reward values", () => {
        expect(sortMerchants(list, "reward").map((m) => m.id)).toEqual([
            "a",
            "b",
            "c",
        ]);
        expect(sortMerchants(list, "expiring").map((m) => m.id)).toEqual([
            "a",
            "b",
            "c",
        ]);
    });

    const rewardValues = new Map<string, MerchantRewardSortValue>([
        ["a", { rewardValue: 5, soonestExpiry: 300 }],
        ["b", { rewardValue: 20, soonestExpiry: 100 }],
        ["c", { rewardValue: 10, soonestExpiry: null }],
    ]);

    test("reward orders by descending reward value", () => {
        expect(
            sortMerchants(list, "reward", rewardValues).map((m) => m.id)
        ).toEqual(["b", "c", "a"]);
    });

    test("expiring orders by soonest expiry, open-ended last", () => {
        expect(
            sortMerchants(list, "expiring", rewardValues).map((m) => m.id)
        ).toEqual(["b", "a", "c"]);
    });

    test("does not mutate the input array", () => {
        const input = [...list];
        sortMerchants(input, "popular");
        expect(input.map((m) => m.id)).toEqual(["a", "b", "c"]);
    });
});
