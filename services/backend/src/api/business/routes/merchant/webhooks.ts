import { db } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { count, eq, max, min } from "drizzle-orm";
import { Elysia, status } from "elysia";
import { MerchantContext } from "../../../../domain/merchant";
import {
    merchantWebhooksTable,
    purchasesTable,
} from "../../../../domain/purchases";
import { businessSessionContext } from "../../middleware/session";

export const merchantWebhooksRoutes = new Elysia({
    prefix: "/:merchantId/webhooks",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({ params: { merchantId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

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

            return {
                setup: true as const,
                platform: currentWebhook.platform,
                webhookSigninKey: currentWebhook.hookSignatureKey,
                stats: {
                    firstPurchase: stats[0]?.firstPurchase ?? undefined,
                    lastPurchase: stats[0]?.lastPurchase ?? undefined,
                    lastUpdate: stats[0]?.lastUpdate ?? undefined,
                    totalPurchaseHandled: stats[0]?.totalPurchaseHandled,
                },
            };
        },
        {
            params: t.Object({ merchantId: t.String() }),
            response: {
                200: t.Union([
                    t.Object({
                        setup: t.Literal(false),
                    }),
                    t.Object({
                        setup: t.Literal(true),
                        platform: t.Union([
                            t.Literal("shopify"),
                            t.Literal("woocommerce"),
                            t.Literal("custom"),
                            t.Literal("internal"),
                        ]),
                        webhookSigninKey: t.String(),
                        stats: t.Partial(
                            t.Object({
                                firstPurchase: t.Date(),
                                lastPurchase: t.Date(),
                                lastUpdate: t.Date(),
                                totalPurchaseHandled: t.Number(),
                            })
                        ),
                    }),
                ]),
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .post(
        "",
        async ({ params: { merchantId }, body, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

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

            return { success: true };
        },
        {
            params: t.Object({ merchantId: t.String() }),
            body: t.Object({
                hookSignatureKey: t.String(),
                platform: t.Union([
                    t.Literal("shopify"),
                    t.Literal("woocommerce"),
                    t.Literal("custom"),
                    t.Literal("internal"),
                ]),
            }),
            response: {
                200: t.Object({ success: t.Boolean() }),
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .delete(
        "",
        async ({ params: { merchantId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

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

            return { success: true };
        },
        {
            params: t.Object({ merchantId: t.String() }),
            response: {
                200: t.Object({ success: t.Boolean() }),
                401: t.String(),
                403: t.String(),
                404: t.String(),
                409: t.String(),
            },
        }
    );
