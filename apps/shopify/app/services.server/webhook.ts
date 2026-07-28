import type { AuthenticatedContext } from "app/types/context";
import { resolveMerchantId } from "./merchant";

type WebhookItem = {
    id: string;
    topic: string;
    filter: string;
    format: "JSON" | "XML";
    endpoint: {
        __typename: string;
        callbackUrl?: string;
    };
};

export type GetWebhooksSubscriptionsReturnType = {
    edges: {
        node: WebhookItem;
    }[];
};

export type CreateWebhookSubscriptionReturnType = {
    userErrors: {
        field: string;
        message: string;
    }[];
    webhookSubscription: WebhookItem | null;
};

export type DeleteWebhookSubscriptionReturnType = {
    deletedWebhookSubscriptionId: string;
    userErrors: {
        code: string;
        field: string;
        message: string;
    }[];
};

/**
 * Host-independent path suffix of a merchant's Frak order webhook. Matching
 * stale webhooks on this (rather than the current backend host) also cleans up
 * subscriptions left on a previous cloudflared tunnel URL, which would
 * otherwise keep receiving orders at a dead endpoint.
 */
function merchantWebhookPath(merchantId: string): string {
    return `/ext/merchant/${merchantId}/webhook/shopify`;
}

/**
 * Build the expected webhook URL for a merchant.
 */
export function buildExpectedWebhookUrl(
    backendUrl: string,
    merchantId: string
): string {
    return `${backendUrl}${merchantWebhookPath(merchantId)}`;
}

/**
 * Backend URL for Shopify webhook callbacks. Shopify's servers must reach this
 * publicly, so it uses PUBLIC_BACKEND_URL — which only differs from BACKEND_URL
 * in the local stage, where `localhost` is unreachable and Shopify rejects it
 * as an internal domain. Falls back to BACKEND_URL when unset.
 */
function webhookBackendUrl(): string {
    return process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "";
}

/**
 * Filter webhook edges to those matching the expected merchant webhook URL.
 */
export function filterWebhooksByMerchantUrl(
    edges: GetWebhooksSubscriptionsReturnType["edges"],
    expectedUrl: string
): GetWebhooksSubscriptionsReturnType["edges"] {
    return edges.filter((webhook) => {
        return webhook.node.endpoint.callbackUrl === expectedUrl;
    });
}

/**
 * Get webhooks matching the current merchant's expected URL.
 */
export async function getWebhooks(
    context: AuthenticatedContext
): Promise<GetWebhooksSubscriptionsReturnType["edges"]> {
    const merchantId = await resolveMerchantId(context);
    const backendUrl = webhookBackendUrl();

    if (!merchantId || !backendUrl) {
        return [];
    }

    const edges = await fetchAllOrdersWebhooks(context.admin.graphql);
    const expectedUrl = buildExpectedWebhookUrl(backendUrl, merchantId);
    return filterWebhooksByMerchantUrl(edges, expectedUrl);
}

/**
 * Fetch all ORDERS_UPDATED webhook subscriptions (unfiltered).
 */
async function fetchAllOrdersWebhooks(
    graphql: AuthenticatedContext["admin"]["graphql"]
): Promise<GetWebhooksSubscriptionsReturnType["edges"]> {
    const response = await graphql(`
    query {
      webhookSubscriptions(first: 20, topics: ORDERS_UPDATED) {
        edges {
          node {
            id
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
        }
      }
    }
  `);
    const {
        data: { webhookSubscriptions },
    } = await response.json();
    return (webhookSubscriptions as GetWebhooksSubscriptionsReturnType).edges;
}

/**
 * Delete all stale webhooks pointing to our backend before creating a new one.
 */
async function deleteStaleBackendWebhooks(
    context: AuthenticatedContext,
    merchantId: string
): Promise<void> {
    const edges = await fetchAllOrdersWebhooks(context.admin.graphql);
    const path = merchantWebhookPath(merchantId);
    const staleWebhooks = edges.filter(
        (webhook) => webhook.node.endpoint.callbackUrl?.includes(path) ?? false
    );
    if (staleWebhooks.length === 0) {
        return;
    }
    await Promise.all(
        staleWebhooks.map((webhook) =>
            deleteWebhook({ ...context, id: webhook.node.id })
        )
    );
}

/**
 * Create a webhook subscription, cleaning up any stale backend webhooks first.
 */
export async function createWebhook(
    context: AuthenticatedContext
): Promise<CreateWebhookSubscriptionReturnType> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return {
            userErrors: [
                {
                    field: "merchantId",
                    message: "Merchant not registered",
                },
            ],
            webhookSubscription: null,
        };
    }
    const backendUrl = webhookBackendUrl();
    const { graphql } = context.admin;

    // Clean up any stale Frak webhooks for this merchant (across any host,
    // including rotated tunnel URLs) before creating the fresh one.
    await deleteStaleBackendWebhooks(context, merchantId);

    const webhookUrl = buildExpectedWebhookUrl(backendUrl, merchantId);
    const response = await graphql(
        `
      mutation webhookSubscriptionCreate(
        $topic: WebhookSubscriptionTopic!
        $webhookSubscription: WebhookSubscriptionInput!
      ) {
        webhookSubscriptionCreate(
          topic: $topic
          webhookSubscription: $webhookSubscription
        ) {
          webhookSubscription {
            id
            topic
            filter
            format
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
        {
            variables: {
                topic: "ORDERS_UPDATED",
                webhookSubscription: {
                    callbackUrl: webhookUrl,
                    format: "JSON",
                },
            },
        }
    );
    const {
        data: { webhookSubscriptionCreate },
    } = await response.json();
    return webhookSubscriptionCreate;
}

/**
 * Delete a webhook subscription
 */
export async function deleteWebhook({
    admin: { graphql },
    id,
}: AuthenticatedContext & {
    id: string;
}): Promise<DeleteWebhookSubscriptionReturnType> {
    const response = await graphql(
        `
      mutation webhookSubscriptionDelete($id: ID!) {
        webhookSubscriptionDelete(id: $id) {
          deletedWebhookSubscriptionId
          userErrors {
            field
            message
          }
        }
      }
    `,
        {
            variables: {
                id,
            },
        }
    );
    const {
        data: { webhookSubscriptionDelete },
    } = await response.json();

    return webhookSubscriptionDelete;
}
