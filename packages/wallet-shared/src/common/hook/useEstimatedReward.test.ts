import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { authenticatedBackendApi } from "../api/backendClient";
import {
    estimatedRewardsQueryOptions,
    selectFormattedReward,
} from "./useEstimatedReward";

vi.mock("../api/backendClient", () => ({
    authenticatedBackendApi: {
        user: {
            merchant: {
                "estimated-rewards": {
                    get: vi.fn(),
                },
            },
        },
    },
}));

const get = () =>
    vi.mocked(authenticatedBackendApi.user.merchant["estimated-rewards"].get);

// The queryFn ignores its context argument, so we can invoke it directly.
const runQueryFn = (merchantId?: string) =>
    (
        estimatedRewardsQueryOptions(merchantId)
            .queryFn as () => Promise<unknown>
    )();

describe("estimatedRewardsQueryOptions", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    test("returns [] without fetching when merchantId is missing", async () => {
        await expect(runQueryFn(undefined)).resolves.toEqual([]);
        expect(get()).not.toHaveBeenCalled();
    });

    test("returns the fetched rewards on success", async () => {
        const rewards = [{ id: "reward-1" }];
        get().mockResolvedValue({ data: { rewards }, error: null } as never);

        await expect(runQueryFn("merchant-1")).resolves.toEqual(rewards);
    });

    test("returns [] for a valid empty response (no campaigns)", async () => {
        get().mockResolvedValue({
            data: { rewards: [] },
            error: null,
        } as never);

        await expect(runQueryFn("merchant-1")).resolves.toEqual([]);
    });

    test("throws on fetch error instead of caching an empty []", async () => {
        const error = new Error("backend down");
        get().mockResolvedValue({ data: null, error } as never);

        await expect(runQueryFn("merchant-1")).rejects.toBe(error);
    });
});

describe("selectFormattedReward product context", () => {
    const fixed = (amount: number) => ({
        payoutType: "fixed" as const,
        amount: {
            amount,
            eurAmount: amount,
            usdAmount: amount,
            gbpAmount: amount,
        },
    });

    // A richer campaign scoped to a product we're not showing, and a poorer
    // one scoped to the product we are.
    const rewards = [
        {
            campaignId: "rich-elsewhere",
            name: "Rich, other product",
            conditions: [],
            interactionTypeKey: "purchase",
            referrer: fixed(50),
            productScope: [{ field: "sku", operator: "eq", value: "HAT-1" }],
        },
        {
            campaignId: "poor-here",
            name: "Poorer, this product",
            conditions: [],
            interactionTypeKey: "purchase",
            referrer: fixed(5),
            productScope: [{ field: "sku", operator: "eq", value: "SHOE-42" }],
        },
    ] as never;

    test("advertises the campaign that applies to the shown product", () => {
        const selected = selectFormattedReward({
            products: [{ sku: "SHOE-42" }],
        })(rewards);

        expect(selected?.formatted).toMatch(/^5\s€$/);
        expect(selected?.matchedProducts).toEqual([{ sku: "SHOE-42" }]);
    });

    test("keeps the unscoped ranking when no product context is given", () => {
        expect(selectFormattedReward({})(rewards)?.formatted).toMatch(
            /^50\s€$/
        );
    });
});
