import type { AuthenticatedContext } from "app/types/context";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
    CreateWebhookSubscriptionReturnType,
    DeleteWebhookSubscriptionReturnType,
    GetWebhooksSubscriptionsReturnType,
} from "./webhook";
import {
    buildExpectedWebhookUrl,
    createWebhook,
    deleteWebhook,
    filterWebhooksByMerchantUrl,
} from "./webhook";

vi.mock("./merchant", () => ({
    resolveMerchantId: vi.fn(),
}));

import { resolveMerchantId } from "./merchant";

const correctUrl =
    "https://backend.frak.id/ext/merchant/merchant-123/webhook/shopify";

const sampleEdges: GetWebhooksSubscriptionsReturnType["edges"] = [
    {
        node: {
            id: "gid://shopify/WebhookSubscription/1",
            topic: "ORDERS_UPDATED",
            filter: "",
            format: "JSON",
            endpoint: {
                __typename: "WebhookHttpEndpoint",
                callbackUrl:
                    "https://backend.frak.id/ext/products/0x123/webhook/oracle/shopify",
            },
        },
    },
    {
        node: {
            id: "gid://shopify/WebhookSubscription/2",
            topic: "ORDERS_UPDATED",
            filter: "",
            format: "JSON",
            endpoint: {
                __typename: "WebhookHttpEndpoint",
                callbackUrl: "https://other-service.example.com/webhook",
            },
        },
    },
    {
        node: {
            id: "gid://shopify/WebhookSubscription/3",
            topic: "ORDERS_UPDATED",
            filter: "",
            format: "JSON",
            endpoint: {
                __typename: "WebhookHttpEndpoint",
                callbackUrl: correctUrl,
            },
        },
    },
];

describe("buildExpectedWebhookUrl", () => {
    it("builds correct URL from backend URL and merchant ID", () => {
        expect(
            buildExpectedWebhookUrl("https://backend.frak.id", "merchant-123")
        ).toBe(correctUrl);
    });
});

describe("webhook filtering", () => {
    it("matches only the exact expected merchant URL", () => {
        const result = filterWebhooksByMerchantUrl(sampleEdges, correctUrl);
        expect(result).toHaveLength(1);
        expect(result[0].node.id).toBe("gid://shopify/WebhookSubscription/3");
    });

    it("rejects old-format product URLs", () => {
        const result = filterWebhooksByMerchantUrl(
            sampleEdges,
            "https://backend.frak.id/ext/merchant/other-merchant/webhook/shopify"
        );
        expect(result).toHaveLength(0);
    });

    it("returns empty when no webhooks match", () => {
        const result = filterWebhooksByMerchantUrl(
            sampleEdges,
            "https://nonexistent.example.com/ext/merchant/abc/webhook/shopify"
        );
        expect(result).toHaveLength(0);
    });

    it("handles empty edges array", () => {
        const result = filterWebhooksByMerchantUrl([], correctUrl);
        expect(result).toHaveLength(0);
    });

    it("handles webhooks without callbackUrl", () => {
        const edges: GetWebhooksSubscriptionsReturnType["edges"] = [
            {
                node: {
                    id: "gid://1",
                    topic: "ORDERS_UPDATED",
                    filter: "",
                    format: "JSON",
                    endpoint: {
                        __typename: "WebhookEventBridgeEndpoint",
                    },
                },
            },
        ];
        const result = filterWebhooksByMerchantUrl(edges, correctUrl);
        expect(result).toHaveLength(0);
    });
});

describe("createWebhook", () => {
    beforeAll(() => {
        process.env.BACKEND_URL = "https://backend.frak.id";
    });

    const emptyWebhooksResponse = {
        json: async () => ({
            data: { webhookSubscriptions: { edges: [] } },
        }),
    };

    it("should return webhook subscription on success", async () => {
        const expectedWebhook: CreateWebhookSubscriptionReturnType = {
            userErrors: [],
            webhookSubscription: {
                id: "gid://shopify/WebhookSubscription/42",
                topic: "ORDERS_UPDATED",
                filter: "",
                format: "JSON",
                endpoint: {
                    __typename: "WebhookHttpEndpoint",
                    callbackUrl:
                        "https://backend.frak.id/ext/merchant/merchant-123/webhook/shopify",
                },
            },
        };

        vi.mocked(resolveMerchantId).mockResolvedValueOnce("merchant-123");

        const mockGraphql = vi
            .fn()
            .mockResolvedValueOnce(emptyWebhooksResponse)
            .mockResolvedValueOnce({
                json: async () => ({
                    data: { webhookSubscriptionCreate: expectedWebhook },
                }),
            });
        const mockContext = {
            admin: { graphql: mockGraphql },
        } as unknown as AuthenticatedContext;

        const result = await createWebhook(mockContext);

        expect(result).toEqual(expectedWebhook);
    });

    it("should return userErrors when merchant not registered", async () => {
        vi.mocked(resolveMerchantId).mockResolvedValueOnce(null);

        const mockGraphql = vi.fn();
        const mockContext = {
            admin: { graphql: mockGraphql },
        } as unknown as AuthenticatedContext;

        const result = await createWebhook(mockContext);

        expect(result.webhookSubscription).toBeNull();
        expect(result.userErrors).toHaveLength(1);
        expect(result.userErrors[0].field).toBe("merchantId");
        expect(result.userErrors[0].message).toBe("Merchant not registered");
        expect(mockGraphql).not.toHaveBeenCalled();
    });

    it("should build correct webhook URL with merchantId", async () => {
        vi.mocked(resolveMerchantId).mockResolvedValueOnce("merchant-123");

        const mockGraphql = vi
            .fn()
            .mockResolvedValueOnce(emptyWebhooksResponse)
            .mockResolvedValueOnce({
                json: async () => ({
                    data: {
                        webhookSubscriptionCreate: {
                            userErrors: [],
                            webhookSubscription: null,
                        },
                    },
                }),
            });
        const mockContext = {
            admin: { graphql: mockGraphql },
        } as unknown as AuthenticatedContext;

        await createWebhook(mockContext);

        const callArgs = mockGraphql.mock.calls[1];
        const variables = callArgs[1].variables;
        expect(variables.webhookSubscription.callbackUrl).toBe(
            "https://backend.frak.id/ext/merchant/merchant-123/webhook/shopify"
        );
    });

    it("should pass correct variables to GraphQL mutation", async () => {
        vi.mocked(resolveMerchantId).mockResolvedValueOnce("merchant-123");

        const mockGraphql = vi
            .fn()
            .mockResolvedValueOnce(emptyWebhooksResponse)
            .mockResolvedValueOnce({
                json: async () => ({
                    data: {
                        webhookSubscriptionCreate: {
                            userErrors: [],
                            webhookSubscription: null,
                        },
                    },
                }),
            });
        const mockContext = {
            admin: { graphql: mockGraphql },
        } as unknown as AuthenticatedContext;

        await createWebhook(mockContext);

        const callArgs = mockGraphql.mock.calls[1];
        const variables = callArgs[1].variables;
        expect(variables.topic).toBe("ORDERS_UPDATED");
        expect(variables.webhookSubscription.format).toBe("JSON");
    });

    it("should call graphql with mutation containing webhookSubscriptionCreate", async () => {
        vi.mocked(resolveMerchantId).mockResolvedValueOnce("merchant-123");

        const mockGraphql = vi
            .fn()
            .mockResolvedValueOnce(emptyWebhooksResponse)
            .mockResolvedValueOnce({
                json: async () => ({
                    data: {
                        webhookSubscriptionCreate: {
                            userErrors: [],
                            webhookSubscription: null,
                        },
                    },
                }),
            });
        const mockContext = {
            admin: { graphql: mockGraphql },
        } as unknown as AuthenticatedContext;

        await createWebhook(mockContext);

        const mutationString = mockGraphql.mock.calls[1][0] as string;
        expect(mutationString).toContain("webhookSubscriptionCreate");
    });
});

describe("deleteWebhook", () => {
    it("should return deleted ID on success", async () => {
        const expectedResult: DeleteWebhookSubscriptionReturnType = {
            deletedWebhookSubscriptionId:
                "gid://shopify/WebhookSubscription/42",
            userErrors: [],
        };

        const mockGraphql = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                data: { webhookSubscriptionDelete: expectedResult },
            }),
        });
        const mockContext = {
            admin: { graphql: mockGraphql },
            id: "gid://shopify/WebhookSubscription/42",
        } as unknown as AuthenticatedContext & { id: string };

        const result = await deleteWebhook(mockContext);

        expect(result).toEqual(expectedResult);
        expect(result.deletedWebhookSubscriptionId).toBe(
            "gid://shopify/WebhookSubscription/42"
        );
        expect(result.userErrors).toHaveLength(0);
    });

    it("should return userErrors on failure", async () => {
        const expectedResult: DeleteWebhookSubscriptionReturnType = {
            deletedWebhookSubscriptionId: "",
            userErrors: [
                {
                    code: "NOT_FOUND",
                    field: "id",
                    message: "Webhook subscription not found",
                },
            ],
        };

        const mockGraphql = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                data: { webhookSubscriptionDelete: expectedResult },
            }),
        });
        const mockContext = {
            admin: { graphql: mockGraphql },
            id: "gid://shopify/WebhookSubscription/999",
        } as unknown as AuthenticatedContext & { id: string };

        const result = await deleteWebhook(mockContext);

        expect(result.userErrors).toHaveLength(1);
        expect(result.userErrors[0].code).toBe("NOT_FOUND");
        expect(result.userErrors[0].message).toBe(
            "Webhook subscription not found"
        );
    });

    it("should pass the correct id variable to GraphQL mutation", async () => {
        const mockGraphql = vi.fn().mockResolvedValueOnce({
            json: async () => ({
                data: {
                    webhookSubscriptionDelete: {
                        deletedWebhookSubscriptionId:
                            "gid://shopify/WebhookSubscription/7",
                        userErrors: [],
                    },
                },
            }),
        });
        const mockContext = {
            admin: { graphql: mockGraphql },
            id: "gid://shopify/WebhookSubscription/7",
        } as unknown as AuthenticatedContext & { id: string };

        await deleteWebhook(mockContext);

        const callArgs = mockGraphql.mock.calls[0];
        expect(callArgs[1].variables.id).toBe(
            "gid://shopify/WebhookSubscription/7"
        );
    });
});
