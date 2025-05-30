import { nextSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { productRoles } from "@frak-labs/app-essentials";
import { count, eq, max, min } from "drizzle-orm";
import { Elysia } from "elysia";
import { oracleContext } from "../context";
import { productOracleTable, purchaseStatusTable } from "../db/schema";

export const managmentRoutes = new Elysia()
    .use(oracleContext)
    .use(nextSessionContext)
    .resolve(({ params: { productId }, error }) => {
        if (!productId) {
            return error(400, "Invalid product id");
        }

        return { productId };
    })
    // Status of the oracle around a product
    .get(
        ":productId/status",
        async ({ productId, oracleDb }) => {
            // Get the current oracle
            const currentOracles = await oracleDb
                .select()
                .from(productOracleTable)
                .where(eq(productOracleTable.productId, productId))
                .limit(1);
            const currentOracle = currentOracles[0];
            if (!currentOracle) {
                return { setup: false };
            }

            // Get some stats about the oracle
            const stats = await oracleDb
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
                webhookSigninKey: currentOracle.hookSignatureKey,
                stats: {
                    firstPurchase: stats[0]?.firstPurchase ?? undefined,
                    lastPurchase: stats[0]?.lastPurchase ?? undefined,
                    lastUpdate: stats[0]?.lastUpdate ?? undefined,
                    totalPurchaseHandled: stats[0]?.totalPurchaseHandled,
                },
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
        ":productId/setup",
        async ({
            body,
            oracleDb,
            productId,
            error,
            businessSession,
            rolesRepository,
        }) => {
            if (!productId) {
                return error(400, "Invalid product id");
            }

            if (!businessSession) {
                return error(401, "Unauthorized");
            }
            const isAllowed = await rolesRepository.hasRoleOrAdminOnProduct({
                wallet: businessSession.wallet,
                productId: BigInt(productId),
                role: productRoles.interactionManager,
            });
            if (!isAllowed) {
                return error(401, "Unauthorized");
            }

            const { hookSignatureKey, platform } = body;

            // Insert or update it
            await oracleDb
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
            nextAuthenticated: "business",
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
    .post(
        ":productId/delete",
        async ({
            productId,
            oracleDb,
            error,
            businessSession,
            rolesRepository,
        }) => {
            if (!businessSession) {
                return error(401, "Unauthorized");
            }
            const isAllowed = await rolesRepository.hasRoleOrAdminOnProduct({
                wallet: businessSession.wallet,
                productId: BigInt(productId),
                role: productRoles.interactionManager,
            });
            if (!isAllowed) {
                return error(401, "Unauthorized");
            }

            // Check if we already got a setup for this product (we could only have one)
            const existingOracle =
                await oracleDb.query.productOracleTable.findFirst({
                    with: { productId },
                });
            if (!existingOracle) {
                return error(
                    404,
                    `Product ${productId} have no current oracle setup`
                );
            }

            // Remove it
            await oracleDb
                .delete(productOracleTable)
                .where(eq(productOracleTable.productId, productId))
                .execute();
        },
        {
            nextAuthenticated: "business",
        }
    );
