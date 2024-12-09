import type { AuthenticatedContext } from "app/types/context";

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
    webhookSubscription: WebhookItem;
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
 * Get all the webhooks
 */
export async function getWebhooks({
    admin: { graphql },
}: AuthenticatedContext): Promise<GetWebhooksSubscriptionsReturnType> {
    const response = await graphql(`
query {
  webhookSubscriptions(first: 1, topics: ORDERS_UPDATED) {
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
}`);
    const {
        data: { webhookSubscriptions },
    } = await response.json();

    return webhookSubscriptions;
}

/**
 * Create a webhook subscription
 */
export async function createWebhook({
    admin: { graphql },
    productId,
}: AuthenticatedContext & {
    productId: string;
}): Promise<CreateWebhookSubscriptionReturnType> {
    const webhookUrl = `${process.env.BACKEND_URL}/oracle/shopify/${productId}/hook`;
    const response = await graphql(
        `
mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
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
}`,
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
}`,
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
