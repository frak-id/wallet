import { drizzleDb } from "app/db.server";
import { log } from "app/services.server/logger";
import { sessionTable } from "db/schema/sessionTable";
import { eq } from "drizzle-orm";
import type { ActionFunctionArgs } from "react-router";
import { purchaseTable } from "../../db/schema/purchaseTable";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { shop, session, topic, payload } =
        await authenticate.webhook(request);

    // NEVER log the raw `payload`: several topics (CUSTOMERS_DATA_REQUEST,
    // CUSTOMERS_REDACT, ...) carry raw customer PII (email/phone/id). Persisting
    // that into Cloud Logging (exportable to BigQuery) is a GDPR violation and
    // directly defeats the purpose of the redaction webhooks. Log only the
    // topic and shop.
    log.info({ topic, shop }, "Received webhook");

    switch (topic) {
        case "APP_UNINSTALLED":
            if (session) {
                // Redelivered after the app is already gone, so the session may
                // have been deleted by an earlier run of this same webhook.
                await drizzleDb
                    .delete(sessionTable)
                    .where(eq(sessionTable.shop, shop));
            }
            break;

        case "APP_PURCHASES_ONE_TIME_UPDATE":
            try {
                const purchaseId = Number.parseInt(
                    payload.app_purchase_one_time.admin_graphql_api_id.replace(
                        "gid://shopify/AppPurchaseOneTime/",
                        ""
                    ),
                    10
                );
                log.info(
                    {
                        shop,
                        purchaseId,
                        status: payload.app_purchase_one_time.status,
                    },
                    "Updating purchase"
                );
                await drizzleDb
                    .update(purchaseTable)
                    .set({
                        status: payload.app_purchase_one_time.status.toLowerCase(),
                        updatedAt: new Date(
                            payload.app_purchase_one_time.updated_at
                        ),
                    })
                    .where(eq(purchaseTable.purchaseId, purchaseId));
            } catch (e) {
                log.error({ err: e, shop }, "Error updating purchase");
            }
            break;

        // GDPR compliance topics. Subscribed because Shopify requires it, and
        // acknowledged with a 200: this app stores only sessions and purchase
        // rows, neither of which holds customer PII, so there is nothing to
        // return or redact.
        // https://shopify.dev/docs/apps/build/privacy-law-compliance
        case "CUSTOMERS_DATA_REQUEST":
        case "CUSTOMERS_REDACT":
        case "SHOP_REDACT":
            break;
    }

    return new Response();
};
