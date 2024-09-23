import { eq } from "drizzle-orm";
import Elysia from "elysia";
import { t } from "../../../../common";
import { productOracleTable } from "../../db/schema";
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
    .get(":productId/status", async ({ productId, businessDb, error }) => {
        // Get the current oracle
        const currentOracle =
            await businessDb.query.productOracleTable.findFirst({
                with: { productId },
            });
        if (!currentOracle) {
            return error(404, `Product ${productId} have no oracle setup`);
        }

        return "ok";
    })
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
