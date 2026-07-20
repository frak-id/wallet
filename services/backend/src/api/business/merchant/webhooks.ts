import { db, log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { count, eq, max, min } from "drizzle-orm";
import { Elysia, status } from "elysia";
import {
    merchantWebhooksTable,
    purchasesTable,
    WebhookPlatformSchema,
} from "../../../domain/purchases";
import {
    MerchantIdParamSchema,
    WebhookStatusResponseSchema,
} from "../../schemas";
import { businessSessionContext } from "../middleware/session";

export const merchantWebhooksRoutes = new Elysia({
    prefix: "/:merchantId/webhooks",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({
            params: { merchantId },
            businessSession,
            hasGenuineMerchantAccess,
        }) => {
            const currentWebhooks = await db
                .select()
                .from(merchantWebhooksTable)
                .where(eq(merchantWebhooksTable.merchantId, merchantId))
                .limit(1);
            const currentWebhook = currentWebhooks[0];

            if (!currentWebhook) {
                return { setup: false as const };
            }

            const stats = await db
                .select({
                    firstPurchase: min(purchasesTable.createdAt),
                    lastPurchase: max(purchasesTable.createdAt),
                    lastUpdate: max(purchasesTable.updatedAt),
                    totalPurchaseHandled: count(),
                })
                .from(purchasesTable)
                .where(eq(purchasesTable.webhookId, currentWebhook.id))
                .execute();

            // `hasMerchantAccess` (route guard above) also grants read-only
            // access via a platform-admin SAFE_METHODS bypass. That bypass
            // must never reveal the raw signing secret (finding 2.8), so the
            // secret field alone is gated on the session-resolved genuine
            // grant (ownership / admin row / Shopify link — no admin bypass).
            const genuineAccess = await hasGenuineMerchantAccess(merchantId);
            if (genuineAccess) {
                log.info(
                    {
                        wallet: businessSession?.wallet,
                        accountId: businessSession?.accountId,
                        merchantId,
                    },
                    "serving webhook signing secret"
                );
            }

            return {
                setup: true as const,
                platform: currentWebhook.platform,
                webhookSigninKey: genuineAccess
                    ? currentWebhook.hookSignatureKey
                    : undefined,
                stats: {
                    firstPurchase: stats[0]?.firstPurchase ?? undefined,
                    lastPurchase: stats[0]?.lastPurchase ?? undefined,
                    lastUpdate: stats[0]?.lastUpdate ?? undefined,
                    totalPurchaseHandled: stats[0]?.totalPurchaseHandled,
                },
            };
        },
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            response: {
                200: WebhookStatusResponseSchema,
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .post(
        "",
        async ({ params: { merchantId }, body }) => {
            const { hookSignatureKey, platform } = body;

            await db
                .insert(merchantWebhooksTable)
                .values({
                    merchantId,
                    hookSignatureKey,
                    platform,
                })
                .onConflictDoUpdate({
                    target: [merchantWebhooksTable.merchantId],
                    set: {
                        hookSignatureKey,
                        platform,
                    },
                })
                .execute();

            return status(204);
        },
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            body: t.Object({
                hookSignatureKey: t.String(),
                platform: WebhookPlatformSchema,
            }),
            response: {
                204: t.Void(),
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .delete(
        "",
        async ({ params: { merchantId } }) => {
            const existingWebhook =
                await db.query.merchantWebhooksTable.findFirst({
                    where: eq(merchantWebhooksTable.merchantId, merchantId),
                });
            if (!existingWebhook) {
                return status(404, "No webhook configured for this merchant");
            }

            const hasPurchases = await db.query.purchasesTable.findFirst({
                where: eq(purchasesTable.webhookId, existingWebhook.id),
                columns: { id: true },
            });
            if (hasPurchases) {
                return status(
                    409,
                    "Cannot delete webhook with existing purchases"
                );
            }

            await db
                .delete(merchantWebhooksTable)
                .where(eq(merchantWebhooksTable.merchantId, merchantId))
                .execute();

            return status(204);
        },
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            response: {
                204: t.Void(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
                409: t.String(),
            },
        }
    );
