import Elysia from "elysia";
import { isHex } from "viem";
import { blockchainContext } from "../../../common";
import { businessOracleContext } from "../context";

export const oracleRoutes = new Elysia({ prefix: "oracle" })
    .use(blockchainContext)
    .use(businessOracleContext)
    .post(
        "/:productId/hook",
        async ({ params: { productId }, body, headers }) => {
            // Then do some shit here
            console.log("Body from webhook", { productId, body, headers });
            // Ensure the product id is valid and in hex format
            if (!(productId && isHex(productId))) {
                throw new Error("Invalid product id");
            }

            // Find the product oracle for this product id
            // const productOracle = await oracleDb.query.productOracle.findFirst({
            //     with: { productId },
            // });
            // if (!productOracle) {
            //     throw new Error("Product oracle not found");
            // }
        }
    );
