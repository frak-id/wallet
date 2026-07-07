import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { describe, expect, test } from "vitest";
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

    // reward/expiring aren't on the list payload, so they keep the input order.
    test("characterizes reward/expiring as no-ops", () => {
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

    test("does not mutate the input array", () => {
        const input = [...list];
        sortMerchants(input, "popular");
        expect(input.map((m) => m.id)).toEqual(["a", "b", "c"]);
    });
});
