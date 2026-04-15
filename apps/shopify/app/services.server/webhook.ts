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
 * Build the expected webhook URL for a merchant.
 */
export function buildExpectedWebhookUrl(
    backendUrl: string,
    merchantId: string
): string {
    return `${backendUrl}/ext/merchant/${merchantId}/webhook/shopify`;
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
    const backendUrl = process.env.BACKEND_URL ?? "";

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
    backendUrl: string
): Promise<void> {
    const edges = await fetchAllOrdersWebhooks(context.admin.graphql);
    const staleWebhooks = edges.filter((webhook) =>
        webhook.node.endpoint.callbackUrl?.includes(backendUrl) ?? false
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
    const backendUrl = process.env.BACKEND_URL ?? "";
    const { graphql } = context.admin;

    // Clean up any stale webhooks pointing to our backend
    await deleteStaleBackendWebhooks(context, backendUrl);

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
