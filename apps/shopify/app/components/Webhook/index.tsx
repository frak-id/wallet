import { useFrakWebhookLink } from "app/hooks/useFrakWebhookLink";
import { useRefreshData } from "app/hooks/useRefreshData";
import type {
    CreateWebhookSubscriptionReturnType,
    DeleteWebhookSubscriptionReturnType,
    GetWebhooksSubscriptionsReturnType,
} from "app/services.server/webhook";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

export type IntentWebhook = "createWebhook" | "deleteWebhook";

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
            window.shopify?.toast.show(t("webhook.actions.messages.error"), {
                isError: true,
            });
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

export function FrakWebhook({
    setup,
    merchantId,
}: {
    setup: boolean;
    merchantId: string;
}) {
    const { t } = useTranslation();

    // The webhook link
    const webhookLink = useFrakWebhookLink({
        merchantId,
    });

    const refresh = useRefreshData();

    // Open webhook link
    const handleSetupWebhook = useCallback(() => {
        const openedWindow = window.open(
            webhookLink,
            "frak-business",
            "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800"
        );

        if (openedWindow) {
            openedWindow.focus();

            // Check every 500ms if the window is closed
            // If it is, revalidate the page
            const timer = setInterval(() => {
                if (openedWindow.closed) {
                    clearInterval(timer);
                    setTimeout(() => refresh(), 1000);
                }
            }, 500);
        }
    }, [webhookLink, refresh]);

    return (
        <>
            {!setup && (
                <s-button variant="primary" onClick={handleSetupWebhook}>
                    {t("webhook.actions.cta.frakConnect")}
                </s-button>
            )}
        </>
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
            window.shopify?.toast.show(t("webhook.actions.messages.error"), {
                isError: true,
            });
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
