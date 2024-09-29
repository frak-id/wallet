import { nextSessionContext } from "@backend-common";
import { t } from "@backend-utils";
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
            isAuthenticated: "business",
            response: t.Union([
                t.Object({
                    setup: t.Literal(false),
                }),
                t.Object({
                    setup: t.Literal(true),
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
        async ({ body, oracleDb, productId, error }) => {
            if (!productId) {
                return error(400, "Invalid product id");
            }

            const { hookSignatureKey } = body;

            // todo: Role check for the wallet
            // todo: Oracle merkle update authorisation setup

            // Insert or update it
            await oracleDb
                .insert(productOracleTable)
                .values({
                    productId,
                    hookSignatureKey,
                })
                .onConflictDoUpdate({
                    target: [productOracleTable.productId],
                    set: {
                        hookSignatureKey,
                    },
                })
                .execute();
        },
        {
            isAuthenticated: "business",
            body: t.Object({
                hookSignatureKey: t.String(),
            }),
        }
    )
    .post(
        ":productId/delete",
        async ({ productId, oracleDb, error }) => {
            // todo: Role check for the wallet
            // todo: Oracle merkle update authorisation setup

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
            isAuthenticated: "business",
        }
    );
