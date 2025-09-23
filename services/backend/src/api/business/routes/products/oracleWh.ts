import { rolesRepository } from "@backend-common";
import { db } from "@backend-common";
import { t } from "@backend-utils";
import { productRoles } from "@frak-labs/app-essentials";
import { count, eq, max, min } from "drizzle-orm";
import { Elysia, status } from "elysia";
import {
    productOracleTable,
    purchaseStatusTable,
} from "../../../../domain/oracle";
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
    // Status of the oracle around a product
    .get(
        "/status",
        async ({ productId, businessSession }) => {
            // Get the current oracle
            const currentOracles = await db
                .select()
                .from(productOracleTable)
                .where(eq(productOracleTable.productId, productId))
                .limit(1);
            const currentOracle = currentOracles[0];
            if (!currentOracle) {
                return { setup: false };
            }

            // Get some stats about the oracle
            const stats = await db
                .select({
                    firstPurchase: min(purchaseStatusTable.createdAt),
                    lastPurchase: max(purchaseStatusTable.createdAt),
                    lastUpdate: max(purchaseStatusTable.updatedAt),
                    totalPurchaseHandled: count(),
                })
                .from(purchaseStatusTable)
                .where(eq(purchaseStatusTable.oracleId, currentOracle.id))
                .execute();

            // Return the oracle status
            return {
                setup: true,
                platform: currentOracle.platform,
                webhookSigninKey: businessSession
                    ? currentOracle.hookSignatureKey
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
    // Setup of an oracle for a product
    .post(
        "/setup",
        async ({ body, productId, businessSession }) => {
            if (!productId) {
                return status(400, "Invalid product id");
            }

            if (!businessSession) {
                return status(401, "Unauthorized");
            }
            const isAllowed = await rolesRepository.hasRoleOrAdminOnProduct({
                wallet: businessSession.wallet,
                productId: BigInt(productId),
                role: productRoles.interactionManager,
            });
            if (!isAllowed) {
                return status(401, "Unauthorized");
            }

            const { hookSignatureKey, platform } = body;

            // Insert or update it
            await db
                .insert(productOracleTable)
                .values({
                    productId,
                    hookSignatureKey,
                    platform,
                })
                .onConflictDoUpdate({
                    target: [productOracleTable.productId],
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
        const isAllowed = await rolesRepository.hasRoleOrAdminOnProduct({
            wallet: businessSession.wallet,
            productId: BigInt(productId),
            role: productRoles.interactionManager,
        });
        if (!isAllowed) {
            return status(401, "Unauthorized");
        }

        // Check if we already got a setup for this product (we could only have one)
        const existingOracle = await db.query.productOracleTable.findFirst({
            with: { productId },
        });
        if (!existingOracle) {
            return status(
                404,
                `Product ${productId} have no current oracle setup`
            );
        }

        // Remove it
        await db
            .delete(productOracleTable)
            .where(eq(productOracleTable.productId, productId))
            .execute();
    });
