import { describe, expect, it } from "vitest";
import type { GetWebhooksSubscriptionsReturnType } from "./webhook";
import { filterWebhooksByBackendUrl } from "./webhook";

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
                callbackUrl:
                    "https://backend.frak.id/ext/products/0x456/webhook/oracle/shopify",
            },
        },
    },
];

describe("webhook filtering", () => {
    it("filters webhooks matching backend URL", () => {
        const result = filterWebhooksByBackendUrl(
            sampleEdges,
            "https://backend.frak.id"
        );
        expect(result).toHaveLength(2);
        expect(result[0].node.id).toBe("gid://shopify/WebhookSubscription/1");
        expect(result[1].node.id).toBe("gid://shopify/WebhookSubscription/3");
    });

    it("returns empty when no webhooks match", () => {
        const result = filterWebhooksByBackendUrl(
            sampleEdges,
            "https://nonexistent.example.com"
        );
        expect(result).toHaveLength(0);
    });

    it("handles empty edges array", () => {
        const result = filterWebhooksByBackendUrl(
            [],
            "https://backend.frak.id"
        );
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
        const result = filterWebhooksByBackendUrl(
            edges,
            "https://backend.frak.id"
        );
        expect(result).toHaveLength(0);
    });

    it("matches partial URL", () => {
        const result = filterWebhooksByBackendUrl(
            sampleEdges,
            "backend.frak.id"
        );
        expect(result).toHaveLength(2);
    });
});
