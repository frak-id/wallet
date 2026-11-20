import { drizzleDb } from "app/db.server";
import { log } from "app/services.server/logger";
import {
    fetchShopContact,
    notifyPaidPurchase,
} from "app/services.server/paymentNotification";
import { isProd } from "app/utils/env";
import { sessionTable } from "db/schema/sessionTable";
import { and, eq, ne } from "drizzle-orm";
import type { ActionFunctionArgs } from "react-router";
import { purchaseTable } from "../../db/schema/purchaseTable";
import { authenticate } from "../shopify.server";

type WebhookContext = Awaited<ReturnType<typeof authenticate.webhook>>;

async function notifyActivated({
    rows,
    shop,
    admin,
    paidAt,
}: Pick<WebhookContext, "shop" | "admin"> & {
    rows: (typeof purchaseTable.$inferSelect)[];
    paidAt: Date;
}) {
    const contact = await fetchShopContact(admin);
    for (const row of rows) {
        await notifyPaidPurchase({
            purchaseId: row.purchaseId,
            shop,
            domain: row.shop,
            amount: row.amount,
            currency: row.currency,
            bank: row.bank,
            paidAt: paidAt.toISOString(),
            test: !isProd(),
            shopName: contact.name,
            email: contact.email,
        });
    }
}

async function updatePurchase({
    shop,
    payload,
    admin,
}: Pick<WebhookContext, "shop" | "payload" | "admin">) {
    const purchaseId = Number.parseInt(
        payload.app_purchase_one_time.admin_graphql_api_id.replace(
            "gid://shopify/AppPurchaseOneTime/",
            ""
        ),
        10
    );
    const status: (typeof purchaseTable.$inferSelect)["status"] =
        payload.app_purchase_one_time.status.toLowerCase();
    const updatedAt = new Date(payload.app_purchase_one_time.updated_at);
    log.info({ shop, purchaseId, status }, "Updating purchase");

    // Only the update that flips the row to active returns it, so a redelivery notifies nothing.
    const isActive = status === "active";
    const rows = await drizzleDb
        .update(purchaseTable)
        .set({ status, updatedAt })
        .where(
            isActive
                ? and(
                      eq(purchaseTable.purchaseId, purchaseId),
                      ne(purchaseTable.status, "active")
                  )
                : eq(purchaseTable.purchaseId, purchaseId)
        )
        .returning();
    if (!isActive || rows.length === 0) return;

    // Not awaited: Shopify wants a 2xx within 5s, and a retry would find the row active anyway.
    notifyActivated({ rows, shop, admin, paidAt: updatedAt }).catch((err) =>
        log.error({ err, shop, purchaseId }, "payment notification failed")
    );
}

export const action = async ({ request }: ActionFunctionArgs) => {
    const { shop, topic, payload, admin } = await authenticate.webhook(request);

    // NEVER log the raw `payload`: several topics (CUSTOMERS_DATA_REQUEST,
    // CUSTOMERS_REDACT, ...) carry raw customer PII (email/phone/id). Persisting
    // that into Cloud Logging (exportable to BigQuery) is a GDPR violation and
    // directly defeats the purpose of the redaction webhooks. Log only the
    // topic and shop.
    log.info({ topic, shop }, "Received webhook");

    switch (topic) {
        case "APP_UNINSTALLED":
            // Not gated on `session`: once the app is gone its refresh token is
            // rejected, so the library hands us no session for an expired token.
            await drizzleDb
                .delete(sessionTable)
                .where(eq(sessionTable.shop, shop));
            break;

        case "APP_PURCHASES_ONE_TIME_UPDATE":
            try {
                await updatePurchase({ shop, payload, admin });
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
