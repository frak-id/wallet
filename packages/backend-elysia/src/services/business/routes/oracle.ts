import { eq } from "drizzle-orm";
import Elysia from "elysia";
import { isHex } from "viem";
import { blockchainContext, t } from "../../../common";
import { businessOracleContext } from "../context";
import { productOracle } from "../db/schema";

export const oracleRoutes = new Elysia({ prefix: "oracle" })
    .use(blockchainContext)
    .use(businessOracleContext)
    .post(
        "/:productId/hook",
        async ({ params: { productId }, body, headers, error }) => {
            // Then do some shit here
            console.log("Body from webhook", {
                productId,
                body: JSON.stringify(body),
                headers: JSON.stringify(headers),
            });
            // Ensure the product id is valid and in hex format
            if (!(productId && isHex(productId))) {
                return error(400, "Invalid product id");
            }

            // Find the product oracle for this product id
            // const productOracle = await oracleDb.query.productOracle.findFirst({
            //     with: { productId },
            // });
            // if (!productOracle) {
            //     throw new Error("Product oracle not found");
            // }
        }
    )
    .get(
        "/:productId/status",
        async ({ params: { productId }, oracleDb, error }) => {
            // Get the current oracle
            const currentOracle = await oracleDb.query.productOracle.findFirst({
                with: { productId },
            });
            if (!currentOracle) {
                return error(404, `Product ${productId} have no oracle setup`);
            }

            return "ok";
        }
    )
    // Management of oracle
    .post(
        "/setup",
        async ({ body, oracleDb }) => {
            const { productId, hookSignatureKey } = body;

            // todo: Check that the business cookie is set
            // todo: Wallet signature with a custom message
            // todo: Role check for the wallet
            // todo: Oracle merkle update authorisation setup

            // Insert or update it
            await oracleDb
                .insert(productOracle)
                .values({
                    productId,
                    hookSignatureKey,
                })
                .onConflictDoUpdate({
                    target: [productOracle.productId],
                    set: {
                        hookSignatureKey,
                    },
                })
                .execute();
        },
        {
            body: t.Object({
                productId: t.Hex(),
                hookSignatureKey: t.String(),
            }),
        }
    )
    .post(
        "/delete",
        async ({ body: { productId }, oracleDb, error }) => {
            // todo: Check that the business cookie is set
            // todo: Wallet signature with a custom message
            // todo: Role check for the wallet
            // todo: Oracle merkle update authorisation setup

            // Check if we already got a setup for this product (we could only have one)
            const existingOracle = await oracleDb.query.productOracle.findFirst(
                {
                    with: { productId },
                }
            );
            if (!existingOracle) {
                return error(404, `Product ${productId} have no current oracle setup`);
            }

            // Remove it
            await oracleDb
                .delete(productOracle)
                .where(eq(productOracle.productId, productId))
                .execute();
        },
        {
            body: t.Object({
                productId: t.Hex(),
            }),
        }
    );
