import { blockchainContext } from "@backend-common/context";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { isHex } from "viem";

export const commonRoutes = new Elysia({ prefix: "/common" })
    .use(blockchainContext)
    .get(
        "/adminWallet",
        async ({ adminWalletsRepository, query, error }) => {
            // Case of a product id
            if (query.productId) {
                if (!isHex(query.productId)) {
                    return error(400, "Invalid productId");
                }

                const account =
                    await adminWalletsRepository.getProductSpecificAccount({
                        productId: BigInt(query.productId),
                    });
                return { pubKey: account.address };
            }

            // Case of a requested type
            if (query.key) {
                const account =
                    await adminWalletsRepository.getKeySpecificAccount({
                        key: query.key,
                    });
                return { pubKey: account.address };
            }

            return error(400, "Invalid query");
        },
        {
            query: t.Partial(
                t.Object({
                    productId: t.Hex(),
                    key: t.String(),
                })
            ),
            response: {
                200: t.Object({
                    pubKey: t.Address(),
                }),
                400: t.String(),
            },
        }
    );
