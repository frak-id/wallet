import {
    CreateShopifyWebhook,
    FrakWebhook,
    type IntentWebhook,
    WebhookList,
} from "app/components/Webhook";
import { getFrakWebookStatus } from "app/services.server/backendMerchant";
import { resolveMerchantId } from "app/services.server/merchant";
import {
    createWebhook,
    deleteWebhook,
    getWebhooks,
} from "app/services.server/webhook";
import { useTranslation } from "react-i18next";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const merchantId = await resolveMerchantId(context);
    const frakWebhook = await getFrakWebookStatus(context, request);
    const webhooks = await getWebhooks(context);
    return { webhooks, frakWebhook, merchantId };
};

export async function action({ request }: ActionFunctionArgs) {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as IntentWebhook;

    switch (intent) {
        case "createWebhook": {
            return await createWebhook(context);
        }

        case "deleteWebhook": {
            const webhookId = formData.get("webhookId");
            if (webhookId) {
                // Delete specific webhook by ID
                return await deleteWebhook({
                    ...context,
                    id: String(webhookId),
                });
            }
            // Delete first webhook (legacy behavior)
            const webhooks = await getWebhooks(context);
            if (!webhooks[0]?.node?.id)
                return { userErrors: [{ message: "Webhook does not exists" }] };
            return await deleteWebhook({ ...context, id: webhooks[0].node.id });
        }
    }
}

export default function SettingsWebhookPage() {
    const data = useLoaderData<typeof loader>();
    const { webhooks, frakWebhook, merchantId } = data;
    const isWebhookExists = webhooks.length > 0;
    const { t } = useTranslation();

    return (
        <s-stack gap="large">
            <s-section>
                <s-stack gap="small">
                    <s-box paddingBlockStart="small" paddingBlockEnd="small">
                        {isWebhookExists && (
                            <s-badge tone="success">
                                {t("webhook.connected")}
                            </s-badge>
                        )}
                        {!isWebhookExists && (
                            <s-badge tone="critical">
                                {t("webhook.notConnected")}
                            </s-badge>
                        )}
                    </s-box>
                    <s-text>
                        {!isWebhookExists && t("webhook.needConnection")}
                    </s-text>
                    {!isWebhookExists && (
                        <s-text>
                            <CreateShopifyWebhook />
                        </s-text>
                    )}

                    {/* Display all webhooks */}
                    <WebhookList webhooks={webhooks} />

                    <s-box paddingBlockStart="small" paddingBlockEnd="small">
                        {frakWebhook.setup && (
                            <s-badge tone="success">
                                {t("webhook.frakConnected")}
                            </s-badge>
                        )}
                        {!frakWebhook.setup && (
                            <s-badge tone="critical">
                                {t("webhook.frakNotConnected")}
                            </s-badge>
                        )}
                    </s-box>
                    {!frakWebhook.setup && (
                        <s-text>{t("webhook.needFrakConnection")}</s-text>
                    )}
                    {merchantId && (
                        <s-text>
                            <FrakWebhook
                                setup={frakWebhook.setup}
                                merchantId={merchantId}
                            />
                        </s-text>
                    )}
                </s-stack>
            </s-section>
        </s-stack>
    );
}
