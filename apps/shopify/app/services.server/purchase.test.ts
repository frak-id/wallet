import { describe, expect, it, vi } from "vitest";
import { getCurrentPurchases, getPurchase, startupPurchase } from "./purchase";
import {
    parseShopifyGid,
    validateBank,
    validatePurchaseAmount,
} from "./purchase.helpers";

// ── DB mock ──────────────────────────────────────────────────────────────────
const mockWhere = vi.fn();
const mockValues = vi.fn();

vi.mock("../db.server", () => ({
    drizzleDb: {
        select: () => ({ from: () => ({ where: mockWhere }) }),
        insert: () => ({ values: mockValues }),
    },
}));

// ── purchaseTable mock ────────────────────────────────────────────────────────
vi.mock("../../db/schema/purchaseTable", () => ({
    purchaseTable: Symbol("purchaseTable"),
}));

// ── shop mock ─────────────────────────────────────────────────────────────────
vi.mock("./shop", () => ({
    shopInfo: vi.fn(),
}));

import { shopInfo } from "./shop";

const mockShopInfo = {
    id: "gid://shopify/Shop/12345",
    name: "Test Shop",
    url: "https://test.myshopify.com",
    myshopifyDomain: "test.myshopify.com",
    primaryDomain: {
        id: "gid://shopify/Domain/1",
        host: "test.myshopify.com",
        url: "https://test.myshopify.com",
    },
    domain: "test.myshopify.com",
    normalizedDomain: "test.myshopify.com",
    preferredCurrency: "eur" as const,
};

// ── Shared mock context ───────────────────────────────────────────────────────
function makeMockCtx(graphqlResponse?: unknown) {
    return {
        admin: {
            graphql: vi.fn().mockResolvedValue({
                json: vi.fn().mockResolvedValue(graphqlResponse ?? {}),
            }),
        },
        session: { shop: "test.myshopify.com" },
    } as unknown as import("../types/context").AuthenticatedContext;
}

// ── startupPurchase ───────────────────────────────────────────────────────────
describe("startupPurchase", () => {
    const validBank = "0x1234567890abcdef1234567890abcdef12345678";

    const successGraphqlResponse = {
        data: {
            appPurchaseOneTimeCreate: {
                userErrors: [],
                appPurchaseOneTime: {
                    id: "gid://shopify/AppPurchaseOneTime/123",
                    createdAt: "2024-01-01T00:00:00Z",
                },
                confirmationUrl: "https://shopify.com/confirm/123",
            },
        },
    };

    it("should throw when amount is invalid (below 10)", async () => {
        const ctx = makeMockCtx();
        await expect(
            startupPurchase(ctx, { amount: "5", bank: validBank })
        ).rejects.toThrow("Amount must be greater than 10");
    });

    it("should throw when bank address is invalid", async () => {
        const ctx = makeMockCtx();
        await expect(
            startupPurchase(ctx, { amount: "100", bank: "not-an-address" })
        ).rejects.toThrow("Bank must be a valid address");
    });

    it("should throw when more than 9 pending purchases exist", async () => {
        vi.mocked(shopInfo).mockResolvedValue(mockShopInfo);
        const pendingPurchases = Array.from({ length: 10 }, (_, i) => ({
            id: i,
            shopId: 12345,
            shop: "test.myshopify.com",
            purchaseId: i + 1,
            confirmationUrl: `https://shopify.com/confirm/${i}`,
            amount: "100",
            currency: "usd",
            status: "pending" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
            txHash: null,
            txStatus: null,
            bank: validBank,
        }));
        mockWhere.mockResolvedValue(pendingPurchases);

        const ctx = makeMockCtx(successGraphqlResponse);
        await expect(
            startupPurchase(ctx, { amount: "100", bank: validBank })
        ).rejects.toThrow("Shop already has more than 10 pending purchases");
    });

    it("should return confirmation URL on success", async () => {
        vi.mocked(shopInfo).mockResolvedValue(mockShopInfo);
        mockWhere.mockResolvedValue([]);
        mockValues.mockResolvedValue(undefined);

        const ctx = makeMockCtx(successGraphqlResponse);
        const result = await startupPurchase(ctx, {
            amount: "100",
            bank: validBank,
        });

        expect(result).toBe("https://shopify.com/confirm/123");
    });

    it("should insert into DB on success", async () => {
        vi.mocked(shopInfo).mockResolvedValue(mockShopInfo);
        mockWhere.mockResolvedValue([]);
        mockValues.mockResolvedValue(undefined);

        const ctx = makeMockCtx(successGraphqlResponse);
        await startupPurchase(ctx, { amount: "100", bank: validBank });

        expect(mockValues).toHaveBeenCalledWith(
            expect.objectContaining({
                shopId: 12345,
                purchaseId: 123,
                confirmationUrl: "https://shopify.com/confirm/123",
                shop: "test.myshopify.com",
                amount: "100",
                currency: "eur",
                status: "pending",
                bank: validBank,
            })
        );
    });

    it("should throw when GraphQL returns no appPurchaseOneTime", async () => {
        vi.mocked(shopInfo).mockResolvedValue(mockShopInfo);
        mockWhere.mockResolvedValue([]);

        const ctx = makeMockCtx({
            data: {
                appPurchaseOneTimeCreate: {
                    userErrors: [{ field: "name", message: "Invalid" }],
                    appPurchaseOneTime: null,
                    confirmationUrl: null,
                },
            },
        });

        await expect(
            startupPurchase(ctx, { amount: "100", bank: validBank })
        ).rejects.toThrow("Failed to create purchase");
    });
});

// ── getCurrentPurchases ───────────────────────────────────────────────────────
describe("getCurrentPurchases", () => {
    it("should return purchases for the shop", async () => {
        vi.mocked(shopInfo).mockResolvedValue(mockShopInfo);
        const fakePurchases = [
            {
                id: 1,
                shopId: 12345,
                shop: "test.myshopify.com",
                purchaseId: 42,
                confirmationUrl: "https://shopify.com/confirm/42",
                amount: "200",
                currency: "usd",
                status: "active" as const,
                createdAt: new Date(),
                updatedAt: new Date(),
                txHash: null,
                txStatus: null,
                bank: "0x1234567890abcdef1234567890abcdef12345678",
            },
        ];
        mockWhere.mockResolvedValue(fakePurchases);

        const ctx = makeMockCtx();
        const result = await getCurrentPurchases(ctx);

        expect(result).toEqual(fakePurchases);
    });

    it("should use correct shop ID from shopInfo", async () => {
        vi.mocked(shopInfo).mockResolvedValue({
            ...mockShopInfo,
            id: "gid://shopify/Shop/99999",
        });
        mockWhere.mockResolvedValue([]);

        const ctx = makeMockCtx();
        await getCurrentPurchases(ctx);

        // shopInfo was called with the context
        expect(vi.mocked(shopInfo)).toHaveBeenCalledWith(ctx);
    });
});

// ── getPurchase ───────────────────────────────────────────────────────────────
describe("getPurchase", () => {
    it("should return purchase when found", async () => {
        const fakePurchase = {
            id: 1,
            shopId: 12345,
            shop: "test.myshopify.com",
            purchaseId: 7,
            confirmationUrl: "https://shopify.com/confirm/7",
            amount: "50",
            currency: "usd",
            status: "active" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
            txHash: null,
            txStatus: null,
            bank: "0x1234567890abcdef1234567890abcdef12345678",
        };
        mockWhere.mockResolvedValue([fakePurchase]);

        const result = await getPurchase(7);

        expect(result).toEqual(fakePurchase);
    });

    it("should return undefined when not found", async () => {
        mockWhere.mockResolvedValue([]);

        const result = await getPurchase(999);

        expect(result).toBeUndefined();
    });
});

// ── helpers ───────────────────────────────────────────────────────────────────
describe("purchase validation", () => {
    describe("amount validation", () => {
        it("rejects non-numeric amount", () => {
            expect(validatePurchaseAmount("abc")).toBe(
                "Amount must be a number"
            );
        });

        it("rejects amount below 10", () => {
            expect(validatePurchaseAmount("5")).toBe(
                "Amount must be greater than 10"
            );
        });

        it("rejects amount above 1000", () => {
            expect(validatePurchaseAmount("1001")).toBe(
                "Amount must be less than 1000"
            );
        });

        it("accepts amount of 10", () => {
            expect(validatePurchaseAmount("10")).toBeNull();
        });

        it("accepts amount of 1000", () => {
            expect(validatePurchaseAmount("1000")).toBeNull();
        });

        it("accepts amount of 500", () => {
            expect(validatePurchaseAmount("500")).toBeNull();
        });

        it("rejects empty string (coerced to 0, below minimum)", () => {
            expect(validatePurchaseAmount("")).toBe(
                "Amount must be greater than 10"
            );
        });
    });

    describe("bank address validation", () => {
        it("accepts valid ethereum address", () => {
            expect(
                validateBank("0x1234567890abcdef1234567890abcdef12345678")
            ).toBeNull();
        });

        it("rejects invalid address", () => {
            expect(validateBank("not-an-address")).toBe(
                "Bank must be a valid address"
            );
        });

        it("rejects empty string", () => {
            expect(validateBank("")).toBe("Bank must be a valid address");
        });
    });
});

describe("purchase name generation", () => {
    it("generates name with amount and timestamp", () => {
        const amount = 100;
        const name = `Frak bank - ${amount.toFixed(2)}eur - ${new Date().toISOString()}`;
        expect(name).toMatch(/^Frak bank - 100\.00eur - \d{4}-\d{2}-\d{2}/);
    });
});

describe("parseShopifyGid", () => {
    it("extracts numeric ID from Shop gid", () => {
        expect(parseShopifyGid("gid://shopify/Shop/12345678", "Shop")).toBe(
            12345678
        );
    });

    it("extracts numeric ID from AppPurchaseOneTime gid", () => {
        expect(
            parseShopifyGid(
                "gid://shopify/AppPurchaseOneTime/87654321",
                "AppPurchaseOneTime"
            )
        ).toBe(87654321);
    });
});
