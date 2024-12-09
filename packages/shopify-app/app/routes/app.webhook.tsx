import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { BlockStack, Card, Page, Text } from "@shopify/polaris";
import { type IntentWebhook, Webhook } from "app/components/Webhook";
import { shopInfo } from "app/services.server/shop";
import {
    createWebhook,
    deleteWebhook,
    getWebhooks,
} from "app/services.server/webhook";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const shop = await shopInfo(context);
    const webhooks = await getWebhooks(context);
    return { shop, webhooks };
};

export async function action({ request }: ActionFunctionArgs) {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as IntentWebhook;

    switch (intent) {
        case "createWebhook": {
            const productId = formData.get("productId");
            if (!productId)
                return { userErrors: [{ message: "productId is missing" }] };
            return createWebhook({ ...context, productId: String(productId) });
        }

        case "deleteWebhook": {
            const webhooks = await getWebhooks(context);
            if (!webhooks.edges[0]?.node?.id)
                return { userErrors: [{ message: "Webhook does not exists" }] };
            return deleteWebhook({ ...context, id: webhooks.edges[0].node.id });
        }
    }
}

export default function WebHookPage() {
    const data = useLoaderData<typeof loader>();
    const { webhooks } = data;
    const isWebhookExists = webhooks.edges.length > 0;
    return (
        <Page title="Webhook">
            <BlockStack gap="500">
                <Card>
                    <BlockStack gap="200">
                        <Text as="p" variant="bodyMd">
                            Your webhook is{" "}
                            <strong>
                                {isWebhookExists
                                    ? "connected"
                                    : "not connected"}
                            </strong>{" "}
                            to your store.
                        </Text>
                        <Text as="p" variant="bodyMd">
                            {!isWebhookExists &&
                                "You need to connect your webhook to your store to track your customers purchases."}
                        </Text>
                        <Text as="p" variant="bodyMd">
                            <Webhook id={webhooks?.edges[0]?.node?.id} />
                        </Text>
                    </BlockStack>
                </Card>
            </BlockStack>
        </Page>
    );
}
