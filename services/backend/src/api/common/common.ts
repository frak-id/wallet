import { adminWalletsRepository, pricingRepository } from "@backend-common";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { isAddress, isHex } from "viem";

/**
 * Common utility routes used across the ecosystem
 * These endpoints provide shared functionality for admin wallets, pricing, etc.
 */
export const commonRoutes = new Elysia({ name: "Routes.common" })
    .get(
        "/adminWallet",
        async ({ query }) => {
            // Case of a product id
            if (query.productId) {
                if (!isHex(query.productId)) {
                    return status(400, "Invalid productId");
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

            return status(400, "Invalid query");
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
    )
    .get(
        "/rate",
        async ({ query: { token } }) => {
            if (!isAddress(token)) {
                return status(400, "Invalid token");
            }

            const rate = await pricingRepository.getTokenPrice({ token });
            if (!rate) {
                return status(400, "Invalid token");
            }

            return rate;
        },
        {
            query: t.Object({
                token: t.Address(),
            }),
            response: {
                200: t.Object({
                    usd: t.Number(),
                    eur: t.Number(),
                    gbp: t.Number(),
                }),
                400: t.String(),
            },
        }
    );
