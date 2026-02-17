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
 * Filter webhook edges to those matching a backend URL.
 */
export function filterWebhooksByBackendUrl(
    edges: GetWebhooksSubscriptionsReturnType["edges"],
    backendUrl: string
): GetWebhooksSubscriptionsReturnType["edges"] {
    return edges.filter((webhook) => {
        return webhook.node.endpoint.callbackUrl?.includes(backendUrl) ?? false;
    });
}

/**
 * Get all the webhooks
 */
export async function getWebhooks({
    admin: { graphql },
}: AuthenticatedContext): Promise<GetWebhooksSubscriptionsReturnType["edges"]> {
    const response = await graphql(`
    query {
      webhookSubscriptions(first: 20, topics: ORDERS_UPDATED) {
        edges {
          node {
            id
            topic
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
    const parsedWebhooks =
        webhookSubscriptions as GetWebhooksSubscriptionsReturnType;

    // Filter for the webhook containing the backend url
    return filterWebhooksByBackendUrl(
        parsedWebhooks.edges,
        process.env.BACKEND_URL ?? ""
    );
}

/**
 * Create a webhook subscription
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
    const { graphql } = context.admin;
    const webhookUrl = `${process.env.BACKEND_URL}/ext/merchant/${merchantId}/webhook/shopify`;
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
