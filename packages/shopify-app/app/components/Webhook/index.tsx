import { useFetcher, useLoaderData } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Button } from "@shopify/polaris";
import type { loader } from "app/routes/app.webhook";
import type {
    CreateWebhookSubscriptionReturnType,
    DeleteWebhookSubscriptionReturnType,
} from "app/services.server/webhook";
import { productIdFromDomain } from "app/utils/productIdFromDomain";
import { useEffect } from "react";

export type IntentWebhook = "createWebhook" | "deleteWebhook";

export function Webhook({ id }: { id?: string }) {
    const { shop } = useLoaderData<typeof loader>();
    const shopify = useAppBridge();
    const fetcher = useFetcher<
        | CreateWebhookSubscriptionReturnType
        | DeleteWebhookSubscriptionReturnType
    >();

    useEffect(() => {
        if (!fetcher.data) return;

        const data = fetcher.data;
        const { userErrors } = data;
        const webhook = (data as CreateWebhookSubscriptionReturnType)
            .webhookSubscription;
        const deletedWebhookId = (data as DeleteWebhookSubscriptionReturnType)
            .deletedWebhookSubscriptionId;

        if (userErrors?.length > 0) {
            shopify.toast.show("Webhook deletion error.", {
                isError: true,
            });
        }

        if (webhook) {
            shopify.toast.show("Webhook connected successfully");
        }

        if (deletedWebhookId) {
            shopify.toast.show("Webhook disconnected successfully");
        }
    }, [fetcher.data, shopify.toast]);

    const handleAction = async (intent: IntentWebhook, productId?: string) => {
        fetcher.submit(
            { intent, productId: productId ?? null },
            { method: "POST" }
        );
    };

    return (
        <>
            {!id && (
                <Button
                    variant="primary"
                    loading={fetcher.state !== "idle"}
                    disabled={fetcher.state !== "idle"}
                    onClick={() => {
                        const productId = productIdFromDomain(
                            shop.myshopifyDomain
                        );
                        handleAction("createWebhook", productId);
                    }}
                >
                    Connect webhook
                </Button>
            )}
            {id && (
                <Button
                    variant="primary"
                    loading={fetcher.state !== "idle"}
                    disabled={fetcher.state !== "idle"}
                    onClick={() => handleAction("deleteWebhook")}
                >
                    Disconnect webhook
                </Button>
            )}
        </>
    );
}
