import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";

vi.mock("./shop", () => ({
    shopInfo: vi.fn(),
}));

vi.mock("@frak-labs/components/shareLink", () => ({
    buildShareLinkUrl: vi.fn(
        ({
            baseUrl,
            payload,
        }: {
            baseUrl: string;
            payload?: Record<string, unknown>;
        }) =>
            `${baseUrl}?frakAction=share&frakData=${encodeURIComponent(
                JSON.stringify(payload ?? {})
            )}`
    ),
}));

import {
    ensureCustomerShareUrlDefinition,
    mintAndStoreCustomerShareUrl,
    mintCustomerShareUrl,
    writeCustomerShareUrl,
} from "./customerShareUrl";
import { shopInfo } from "./shop";

const mockShop = {
    id: "gid://shopify/Shop/1",
    name: "Acme",
    url: "https://acme.myshopify.com",
    myshopifyDomain: "acme.myshopify.com",
    primaryDomain: {
        id: "gid://shopify/Domain/1",
        host: "acme.com",
        url: "https://acme.com",
    },
    domain: "acme.com",
    normalizedDomain: "acme.com",
    preferredCurrency: "eur",
};

function makeCtx(overrides?: Partial<{ graphqlResponse: unknown }>) {
    const graphql = vi.fn().mockResolvedValue({
        json: async () =>
            overrides?.graphqlResponse ?? {
                data: {
                    metafieldDefinitionCreate: {
                        createdDefinition: { id: "gid://shopify/Def/1" },
                        userErrors: [],
                    },
                    metafieldsSet: { metafields: [], userErrors: [] },
                },
            },
    });
    return {
        admin: { graphql },
        session: { shop: "acme.myshopify.com" },
    } as unknown as AuthenticatedContext;
}

describe("customerShareUrl", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(shopInfo).mockResolvedValue(mockShop as never);
    });

    describe("mintCustomerShareUrl", () => {
        it("builds a URL anchored on the primary domain", async () => {
            const ctx = makeCtx();

            const url = await mintCustomerShareUrl(ctx);

            expect(url).toContain("https://acme.com");
            expect(url).toContain("frakAction=share");
            expect(url).toContain("frakData=");
        });

        it("falls back to shop.url when primaryDomain is absent", async () => {
            vi.mocked(shopInfo).mockResolvedValueOnce({
                ...mockShop,
                primaryDomain: undefined,
            } as never);
            const ctx = makeCtx();

            const url = await mintCustomerShareUrl(ctx);

            expect(url).toContain("https://acme.myshopify.com");
        });

        it("includes products in the encoded payload when provided", async () => {
            const ctx = makeCtx();

            const url = await mintCustomerShareUrl(ctx, {
                products: [{ title: "Red shirt" }],
            });

            const frakData = new URL(url).searchParams.get("frakData");
            expect(frakData).toBeTruthy();
            const decoded = JSON.parse(frakData ?? "{}");
            expect(decoded.products).toEqual([{ title: "Red shirt" }]);
        });
    });

    describe("writeCustomerShareUrl", () => {
        it("returns success=true when GraphQL has no user errors", async () => {
            const ctx = makeCtx();

            const result = await writeCustomerShareUrl(ctx, {
                customerGid: "gid://shopify/Customer/1",
                shareUrl: "https://acme.com?frakAction=share",
            });

            expect(result.success).toBe(true);
            expect(result.userErrors).toEqual([]);
        });

        it("returns success=false when GraphQL returns user errors", async () => {
            const ctx = makeCtx({
                graphqlResponse: {
                    data: {
                        metafieldsSet: {
                            metafields: [],
                            userErrors: [
                                { field: ["ownerId"], message: "Invalid GID" },
                            ],
                        },
                    },
                },
            });

            const result = await writeCustomerShareUrl(ctx, {
                customerGid: "gid://shopify/Customer/bad",
                shareUrl: "https://acme.com?frakAction=share",
            });

            expect(result.success).toBe(false);
            expect(result.userErrors).toHaveLength(1);
        });
    });

    describe("ensureCustomerShareUrlDefinition", () => {
        it("treats a TAKEN error as success (idempotent)", async () => {
            const ctx = makeCtx({
                graphqlResponse: {
                    data: {
                        metafieldDefinitionCreate: {
                            createdDefinition: null,
                            userErrors: [
                                {
                                    field: ["definition", "key"],
                                    message: "Key already taken",
                                    code: "TAKEN",
                                },
                            ],
                        },
                    },
                },
            });

            await expect(
                ensureCustomerShareUrlDefinition(ctx)
            ).resolves.toBeUndefined();

            // Second call hits the in-memory cache and skips GraphQL
            await ensureCustomerShareUrlDefinition(ctx);
            expect(ctx.admin.graphql).toHaveBeenCalledTimes(1);
        });

        it("logs but does not throw on transport failure", async () => {
            const ctx = makeCtx();
            vi.mocked(ctx.admin.graphql).mockRejectedValueOnce(
                new Error("network down")
            );
            const errSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            // Use a different shop in shopInfo so cache from prior tests doesn't short-circuit.
            vi.mocked(shopInfo).mockResolvedValueOnce({
                ...mockShop,
                normalizedDomain: "transport-fail.myshopify.com",
            } as never);

            await expect(
                ensureCustomerShareUrlDefinition(ctx)
            ).resolves.toBeUndefined();
            expect(errSpy).toHaveBeenCalled();

            errSpy.mockRestore();
        });
    });

    describe("mintAndStoreCustomerShareUrl", () => {
        it("calls definition + mint + write in sequence", async () => {
            const ctx = makeCtx();

            // Use a fresh shop so the definition cache doesn't short-circuit
            vi.mocked(shopInfo).mockResolvedValue({
                ...mockShop,
                normalizedDomain: "fresh-shop.myshopify.com",
            } as never);

            await mintAndStoreCustomerShareUrl(ctx, {
                customerGid: "gid://shopify/Customer/42",
            });

            // 2 GraphQL calls: definitionCreate + metafieldsSet
            expect(ctx.admin.graphql).toHaveBeenCalledTimes(2);
        });

        it("swallows errors so the webhook caller never sees them", async () => {
            const ctx = makeCtx();
            vi.mocked(ctx.admin.graphql).mockRejectedValue(new Error("boom"));
            const errSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            await expect(
                mintAndStoreCustomerShareUrl(ctx, {
                    customerGid: "gid://shopify/Customer/1",
                })
            ).resolves.toBeUndefined();

            errSpy.mockRestore();
        });

        it("enriches the first line item with handle and featured image", async () => {
            const ctx = makeCtx();
            const graphql = ctx.admin.graphql as ReturnType<typeof vi.fn>;

            graphql.mockReset();
            graphql
                .mockResolvedValueOnce({
                    json: async () => ({
                        data: {
                            metafieldDefinitionCreate: {
                                createdDefinition: {
                                    id: "gid://shopify/Def/1",
                                },
                                userErrors: [],
                            },
                        },
                    }),
                })
                .mockResolvedValueOnce({
                    json: async () => ({
                        data: {
                            product: {
                                handle: "red-shirt",
                                featuredImage: {
                                    url: "https://acme.com/r.png",
                                },
                            },
                        },
                    }),
                })
                .mockResolvedValueOnce({
                    json: async () => ({
                        data: {
                            metafieldsSet: { metafields: [], userErrors: [] },
                        },
                    }),
                });

            vi.mocked(shopInfo).mockResolvedValue({
                ...mockShop,
                normalizedDomain: "rich-shop.myshopify.com",
            } as never);

            await mintAndStoreCustomerShareUrl(ctx, {
                customerGid: "gid://shopify/Customer/42",
                lineItems: [
                    {
                        productGid: "gid://shopify/Product/100",
                        title: "Red shirt",
                    },
                ],
            });

            // 3 GraphQL calls: definitionCreate + product fetch + metafieldsSet
            expect(graphql).toHaveBeenCalledTimes(3);

            const metafieldsSetCall = graphql.mock.calls[2];
            const variables = (metafieldsSetCall[1] as { variables: { metafields: Array<{ value: string }> } }).variables;
            const shareUrl = variables.metafields[0].value;
            const frakData = new URL(shareUrl).searchParams.get("frakData");
            expect(frakData).toBeTruthy();
            const decoded = JSON.parse(frakData ?? "{}");
            expect(decoded.products).toEqual([
                {
                    title: "Red shirt",
                    imageUrl: "https://acme.com/r.png",
                    link: "https://acme.com/products/red-shirt",
                },
            ]);
        });

        it("falls back to title-only when product fetch returns no handle", async () => {
            const ctx = makeCtx();
            const graphql = ctx.admin.graphql as ReturnType<typeof vi.fn>;

            graphql.mockReset();
            graphql
                .mockResolvedValueOnce({
                    json: async () => ({
                        data: {
                            metafieldDefinitionCreate: {
                                createdDefinition: { id: "gid://shopify/Def/1" },
                                userErrors: [],
                            },
                        },
                    }),
                })
                .mockResolvedValueOnce({
                    json: async () => ({ data: { product: null } }),
                })
                .mockResolvedValueOnce({
                    json: async () => ({
                        data: {
                            metafieldsSet: { metafields: [], userErrors: [] },
                        },
                    }),
                });

            vi.mocked(shopInfo).mockResolvedValue({
                ...mockShop,
                normalizedDomain: "fallback-shop.myshopify.com",
            } as never);

            await mintAndStoreCustomerShareUrl(ctx, {
                customerGid: "gid://shopify/Customer/42",
                lineItems: [
                    {
                        productGid: "gid://shopify/Product/100",
                        title: "Mystery item",
                    },
                ],
            });

            const metafieldsSetCall = graphql.mock.calls[2];
            const variables = (metafieldsSetCall[1] as { variables: { metafields: Array<{ value: string }> } }).variables;
            const shareUrl = variables.metafields[0].value;
            const frakData = new URL(shareUrl).searchParams.get("frakData");
            const decoded = JSON.parse(frakData ?? "{}");
            expect(decoded.products).toEqual([{ title: "Mystery item" }]);
        });
    });
});
