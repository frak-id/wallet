import { db, onChainRolesRepository } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { productRoles } from "@frak-labs/app-essentials";
import { count, eq, max, min } from "drizzle-orm";
import { Elysia, status } from "elysia";
import {
    merchantWebhooksTable,
    purchasesTable,
} from "../../../../domain/purchases";
import { businessSessionContext } from "../../middleware/session";

export const oracleWhRoutes = new Elysia({ prefix: "/oracleWebhook" })
    .use(businessSessionContext)
    .guard({
        params: t.Object({
            productId: t.Optional(t.Hex()),
        }),
    })
    .resolve(({ params: { productId } }) => {
        if (!productId) {
            return status(400, "Invalid product id");
        }

        return { productId };
    })
    .get(
        "/status",
        async ({ productId, businessSession }) => {
            const currentWebhooks = await db
                .select()
                .from(merchantWebhooksTable)
                .where(eq(merchantWebhooksTable.productId, productId))
                .limit(1);
            const currentWebhook = currentWebhooks[0];
            if (!currentWebhook) {
                return { setup: false };
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
                setup: true,
                platform: currentWebhook.platform,
                webhookSigninKey: businessSession
                    ? currentWebhook.hookSignatureKey
                    : "redacted",
                stats: businessSession
                    ? {
                          firstPurchase: stats[0]?.firstPurchase ?? undefined,
                          lastPurchase: stats[0]?.lastPurchase ?? undefined,
                          lastUpdate: stats[0]?.lastUpdate ?? undefined,
                          totalPurchaseHandled: stats[0]?.totalPurchaseHandled,
                      }
                    : undefined,
            };
        },
        {
            response: t.Union([
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
                    stats: t.Optional(
                        t.Partial(
                            t.Object({
                                firstPurchase: t.Date(),
                                lastPurchase: t.Date(),
                                lastUpdate: t.Date(),
                                totalPurchaseHandled: t.Number(),
                            })
                        )
                    ),
                }),
            ]),
        }
    )
    .post(
        "/setup",
        async ({ body, productId, businessSession }) => {
            if (!productId) {
                return status(400, "Invalid product id");
            }

            if (!businessSession) {
                return status(401, "Unauthorized");
            }
            const isAllowed =
                await onChainRolesRepository.hasRoleOrAdminOnProduct({
                    wallet: businessSession.wallet,
                    productId: BigInt(productId),
                    role: productRoles.interactionManager,
                });
            if (!isAllowed) {
                return status(401, "Unauthorized");
            }

            const { hookSignatureKey, platform } = body;

            await db
                .insert(merchantWebhooksTable)
                .values({
                    productId,
                    hookSignatureKey,
                    platform,
                })
                .onConflictDoUpdate({
                    target: [merchantWebhooksTable.productId],
                    set: {
                        hookSignatureKey,
                        platform,
                    },
                })
                .execute();
        },
        {
            body: t.Object({
                hookSignatureKey: t.String(),
                platform: t.Union([
                    t.Literal("shopify"),
                    t.Literal("woocommerce"),
                    t.Literal("custom"),
                    t.Literal("internal"),
                ]),
            }),
        }
    )
    .post("/delete", async ({ productId, businessSession }) => {
        if (!businessSession) {
            return status(401, "Unauthorized");
        }
        const isAllowed = await onChainRolesRepository.hasRoleOrAdminOnProduct({
            wallet: businessSession.wallet,
            productId: BigInt(productId),
            role: productRoles.interactionManager,
        });
        if (!isAllowed) {
            return status(401, "Unauthorized");
        }

        const existingWebhook = await db.query.merchantWebhooksTable.findFirst({
            where: eq(merchantWebhooksTable.productId, productId),
        });
        if (!existingWebhook) {
            return status(
                404,
                `Product ${productId} has no current webhook setup`
            );
        }

        await db
            .delete(merchantWebhooksTable)
            .where(eq(merchantWebhooksTable.productId, productId))
            .execute();
    });
