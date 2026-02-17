import { drizzleDb } from "app/db.server";
import { sessionTable } from "db/schema/sessionTable";
import { eq } from "drizzle-orm";
import type { ActionFunctionArgs } from "react-router";
import { purchaseTable } from "../../db/schema/purchaseTable";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { shop, session, topic, payload } =
        await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`, payload);

    switch (topic) {
        /*
        When a shop is uninstalled, the APP_UNINSTALLED webhook is sent to the app.
        The app should use this information to delete any data that it has stored for the shop.

        PAYLOAD app/uninstalled
        */
        case "APP_UNINSTALLED":
            if (session) {
                // Webhook requests can trigger multiple times and after an app has already been uninstalled.
                // If this webhook already ran, the session may have been deleted previously.
                await drizzleDb
                    .delete(sessionTable)
                    .where(eq(sessionTable.shop, shop));
            }
            break;
        /*
        GDPR compliance webhooks
        https://shopify.dev/docs/apps/build/privacy-law-compliance#subscribe-to-compliance-webhooks

        Hooks can be tested using the Shopify CLI:
        shopify app webhook trigger --topic=customers/data_request --address=$SHOPIFY_URL/webhooks/app/compliance --api-version=2025-01
        */

        case "APP_PURCHASES_ONE_TIME_UPDATE":
            /*
         PAYLOAD app_purchases_one_time/update

         {
            admin_graphql_api_id: 'gid://shopify/AppPurchaseOneTime/3843850573',
            name: 'Frak bank - 15.00usd - 2025-05-08T15:25:17.829Z',
            status: 'ACTIVE',
            admin_graphql_api_shop_id: 'gid://shopify/Shop/85403009357',
            created_at: '2025-05-08T11:25:18-04:00',
            updated_at: '2025-05-08T11:25:29-04:00'
        }
        */
            try {
                console.log("Received purchase update", payload);
                const purchaseId = Number.parseInt(
                    payload.app_purchase_one_time.admin_graphql_api_id.replace(
                        "gid://shopify/AppPurchaseOneTime/",
                        ""
                    ),
                    10
                );
                console.log("Updating purchase", purchaseId);
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
                console.error("Error updating purchase", e);
            }
            break;

        case "CUSTOMERS_DATA_REQUEST":
        /*
         When a customer requests their data, the CUSTOMERS_DATA_REQUEST webhook is sent to the app.
         The app should use this information to prepare the data for the customer.
         Data must be sent to the customer directly on his email address.

         PAYLOAD customers/data_request

         {
            "shop_id": 954889,
            "shop_domain": "{shop}.myshopify.com",
            "orders_requested": [299938, 280263, 220458],
            "customer": {
                "id": 191167,
                "email": "john@example.com",
                "phone":  "555-625-1199"
            },
            "data_request": {
                "id": 9999
            }
         }
         */
        case "CUSTOMERS_REDACT":
        /*
         When a customer requests to be forgotten, the CUSTOMERS_REDACT webhook is sent to the app.

         PAYLOAD customers/redact

         {
            "shop_id": 954889,
            "shop_domain": "{shop}.myshopify.com",
            "customer": {
                "id": 191167,
                "email": "john@example.com",
                "phone": "555-625-1199"
            },
            "orders_to_redact": [299938, 280263, 220458]
         }
         */
        case "SHOP_REDACT":
        /*
         When a shop is uninstalled, the SHOP_REDACT webhook is sent to the app.
         The app should use this information to delete any data that it has stored for the shop.

         PAYLOAD shop/redact

         {
            "shop_id": 954889,
            "shop_domain": "{shop}.myshopify.com"
         }
         */
    }

    return new Response();
};
