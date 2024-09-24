import { count, eq, max, min } from "drizzle-orm";
import Elysia from "elysia";
import { t } from "../../../../common";
import { productOracleTable, purchaseStatusTable } from "../../db/schema";
import { businessOracleContext } from "../context";

export const managmentRoutes = new Elysia()
    .use(businessOracleContext)
    .resolve(({ params: { productId }, error }) => {
        if (!productId) {
            return error(400, "Invalid product id");
        }

        return { productId };
    })
    // Status of the oracle around a product
    .get(
        ":productId/status",
        async ({ productId, businessDb }) => {
            // Get the current oracle
            const currentOracles = await businessDb
                .select()
                .from(productOracleTable)
                .where(eq(productOracleTable.productId, productId))
                .limit(1);
            const currentOracle = currentOracles[0];
            if (!currentOracle) {
                return { setup: false };
            }

            // Get some stats about the oracle
            const stats = await businessDb
                .select({
                    firstPurchase: min(purchaseStatusTable.createdAt),
                    lastPurchase: max(purchaseStatusTable.createdAt),
                    lastUpdate: max(purchaseStatusTable.updatedAt),
                    totalPurchaseHandled: count(),
                })
                .from(purchaseStatusTable)
                .where(eq(purchaseStatusTable.oracleId, 1))
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
        async ({ body, businessDb, productId, error }) => {
            if (!productId) {
                return error(400, "Invalid product id");
            }

            const { hookSignatureKey } = body;

            // todo: Check that the business cookie is set
            // todo: Wallet signature with a custom message
            // todo: Role check for the wallet
            // todo: Oracle merkle update authorisation setup

            // Insert or update it
            await businessDb
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
            body: t.Object({
                hookSignatureKey: t.String(),
            }),
        }
    )
    .post(":productId/delete", async ({ productId, businessDb, error }) => {
        // todo: Check that the business cookie is set
        // todo: Wallet signature with a custom message
        // todo: Role check for the wallet
        // todo: Oracle merkle update authorisation setup

        // Check if we already got a setup for this product (we could only have one)
        const existingOracle =
            await businessDb.query.productOracleTable.findFirst({
                with: { productId },
            });
        if (!existingOracle) {
            return error(
                404,
                `Product ${productId} have no current oracle setup`
            );
        }

        // Remove it
        await businessDb
            .delete(productOracleTable)
            .where(eq(productOracleTable.productId, productId))
            .execute();
    });
