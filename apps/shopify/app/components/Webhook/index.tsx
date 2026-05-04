import type {
    CreateWebhookSubscriptionReturnType,
    DeleteWebhookSubscriptionReturnType,
    GetWebhooksSubscriptionsReturnType,
} from "app/services.server/webhook";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

export type IntentWebhook =
    | "createWebhook"
    | "deleteWebhook"
    | "setupFrakWebhook";

export function CreateShopifyWebhook() {
    const fetcher = useFetcher<
        | CreateWebhookSubscriptionReturnType
        | DeleteWebhookSubscriptionReturnType
    >();
    const { t } = useTranslation();

    useEffect(() => {
        if (!fetcher.data) return;

        const data = fetcher.data;
        const { userErrors } = data;
        const webhook = (data as CreateWebhookSubscriptionReturnType)
            .webhookSubscription;
        const deletedWebhookId = (data as DeleteWebhookSubscriptionReturnType)
            .deletedWebhookSubscriptionId;

        if (userErrors?.length > 0) {
            window.shopify?.toast.show(
                t("webhook.actions.messages.createError"),
                {
                    isError: true,
                }
            );
        }

        if (webhook) {
            window.shopify?.toast.show(t("webhook.actions.messages.connect"));
        }

        if (deletedWebhookId) {
            window.shopify?.toast.show(
                t("webhook.actions.messages.disconnect")
            );
        }
    }, [fetcher.data, t]);

    const handleAction = async (intent: IntentWebhook) => {
        fetcher.submit(
            { intent },
            { method: "POST", action: "/app/settings/webhook" }
        );
    };

    return (
        <s-button
            variant="primary"
            loading={fetcher.state !== "idle"}
            disabled={fetcher.state !== "idle"}
            onClick={() => {
                handleAction("createWebhook");
            }}
        >
            {t("webhook.actions.cta.connect")}
        </s-button>
    );
}

export function FrakWebhook({ setup }: { setup: boolean; merchantId: string }) {
    const fetcher = useFetcher<{
        success: boolean;
        userErrors: { message: string }[];
    }>();
    const { t } = useTranslation();

    useEffect(() => {
        if (!fetcher.data) return;

        if (fetcher.data.success) {
            window.shopify?.toast.show(t("webhook.actions.messages.setup"));
        } else {
            window.shopify?.toast.show(
                t("webhook.actions.messages.frakSetupError"),
                { isError: true }
            );
        }
    }, [fetcher.data, t]);

    if (setup) return null;

    return (
        <s-button
            variant="primary"
            loading={fetcher.state !== "idle"}
            disabled={fetcher.state !== "idle"}
            onClick={() => {
                fetcher.submit(
                    { intent: "setupFrakWebhook" },
                    { method: "POST", action: "/app/settings/webhook" }
                );
            }}
        >
            {t("webhook.actions.cta.frakConnect")}
        </s-button>
    );
}

export function WebhookList({
    webhooks,
}: {
    webhooks: GetWebhooksSubscriptionsReturnType["edges"];
}) {
    const { t } = useTranslation();
    const fetcher = useFetcher<DeleteWebhookSubscriptionReturnType>();

    useEffect(() => {
        if (!fetcher.data) return;

        const data = fetcher.data;
        const { userErrors } = data;
        const deletedWebhookId = data.deletedWebhookSubscriptionId;

        if (userErrors?.length > 0) {
            window.shopify?.toast.show(
                t("webhook.actions.messages.deleteError"),
                {
                    isError: true,
                }
            );
        }

        if (deletedWebhookId) {
            window.shopify?.toast.show(
                t("webhook.actions.messages.disconnect")
            );
        }
    }, [fetcher.data, t]);

    const handleDeleteWebhook = (webhookId: string) => {
        fetcher.submit(
            { intent: "deleteWebhook", webhookId },
            { method: "POST", action: "/app/settings/webhook" }
        );
    };

    if (webhooks.length === 0) {
        return <s-text tone="neutral">{t("webhook.noWebhooks")}</s-text>;
    }

    return (
        <s-stack gap="base">
            <s-heading>{t("webhook.list.title")}</s-heading>
            {webhooks.map(({ node }) => (
                <s-section key={node.id}>
                    <s-stack gap="small">
                        <s-text>
                            <strong>{t("webhook.list.topic")}:</strong>{" "}
                            {node.topic}
                        </s-text>
                        <s-text>
                            <strong>{t("webhook.list.endpoint")}:</strong>{" "}
                            {node.endpoint.callbackUrl ||
                                t("webhook.list.noEndpoint")}
                        </s-text>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                            }}
                        >
                            <s-button
                                variant="primary"
                                tone="critical"
                                loading={fetcher.state !== "idle"}
                                disabled={fetcher.state !== "idle"}
                                onClick={() => handleDeleteWebhook(node.id)}
                            >
                                {t("webhook.actions.cta.delete")}
                            </s-button>
                        </div>
                    </s-stack>
                </s-section>
            ))}
        </s-stack>
    );
}
