import type { IntentWebhook } from "app/components/Webhook";
import { setupFrakWebhook } from "app/services.server/backendMerchant";
import { log } from "app/services.server/logger";
import {
    createWebhook,
    deleteWebhook,
    getWebhooks,
} from "app/services.server/webhook";
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// Action-only route: the settings page (app.settings.tsx) renders the
// webhook UI directly, but app/components/Webhook/index.tsx fetcher-submits
// here.
export async function action({ request }: ActionFunctionArgs) {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as IntentWebhook;

    // Fail open: a transient Shopify/backend error degrades to a surfaced
    // userError instead of bouncing the whole settings page to a full-page
    // error (consistent with app.appearance.tsx).
    try {
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
                    return {
                        userErrors: [{ message: "Webhook does not exists" }],
                    };
                return await deleteWebhook({
                    ...context,
                    id: webhooks[0].node.id,
                });
            }

            case "setupFrakWebhook": {
                return await setupFrakWebhook(context, request);
            }
        }
    } catch (error) {
        log.error({ err: error, intent }, "webhook action failed");
        return {
            userErrors: [
                { message: "Something went wrong. Please try again." },
            ],
        };
    }
}
