import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { describe, expect, test } from "vitest";
import { sortMerchants } from "./sortMerchants";

function merchant(
    id: string,
    overrides: Partial<ExplorerMerchantItem> = {}
): ExplorerMerchantItem {
    return {
        id,
        name: id,
        domain: `${id}.example`,
        explorerConfig: null,
        activeCampaignCount: 0,
        integration: "native",
        popularity: 0,
        views: 0,
        recent: null,
        expiring: null,
        reward: null,
        ...overrides,
    };
}

const iso = (offsetMs: number) =>
    new Date(Date.parse("2026-01-01T00:00:00.000Z") + offsetMs).toISOString();

const list = [
    merchant("a", {
        popularity: 1,
        views: 30,
        recent: iso(100),
        expiring: iso(300),
        reward: 5,
    }),
    merchant("b", {
        popularity: 3,
        views: 10,
        recent: iso(300),
        expiring: iso(100),
        reward: 20,
    }),
    merchant("c", {
        popularity: 2,
        views: 20,
        recent: iso(200),
        expiring: null,
        reward: 10,
    }),
];

describe("sortMerchants", () => {
    test("recommended preserves the server-provided order", () => {
        expect(sortMerchants(list, "recommended").map((m) => m.id)).toEqual([
            "a",
            "b",
            "c",
        ]);
    });

    test("popular orders by descending popularity", () => {
        expect(sortMerchants(list, "popular").map((m) => m.id)).toEqual([
            "b",
            "c",
            "a",
        ]);
    });

    test("views orders by descending view count", () => {
        expect(sortMerchants(list, "views").map((m) => m.id)).toEqual([
            "a",
            "c",
            "b",
        ]);
    });

    test("recent orders by freshest campaign first", () => {
        expect(sortMerchants(list, "recent").map((m) => m.id)).toEqual([
            "b",
            "c",
            "a",
        ]);
    });

    test("recent sorts merchants without a timestamp last", () => {
        const withNull = [
            merchant("x", { recent: null }),
            merchant("y", { recent: iso(100) }),
        ];
        expect(sortMerchants(withNull, "recent").map((m) => m.id)).toEqual([
            "y",
            "x",
        ]);
    });

    test("reward orders by descending reward value", () => {
        expect(sortMerchants(list, "reward").map((m) => m.id)).toEqual([
            "b",
            "c",
            "a",
        ]);
    });

    test("reward treats a null reward as zero (sorts last)", () => {
        const withNull = [
            merchant("x", { reward: null }),
            merchant("y", { reward: 1 }),
        ];
        expect(sortMerchants(withNull, "reward").map((m) => m.id)).toEqual([
            "y",
            "x",
        ]);
    });

    test("expiring orders by soonest expiry, open-ended last", () => {
        expect(sortMerchants(list, "expiring").map((m) => m.id)).toEqual([
            "b",
            "a",
            "c",
        ]);
    });

    test("does not mutate the input array", () => {
        const input = [...list];
        sortMerchants(input, "popular");
        expect(input.map((m) => m.id)).toEqual(["a", "b", "c"]);
    });
});
