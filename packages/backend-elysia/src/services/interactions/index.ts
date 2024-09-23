import { Elysia } from "elysia";
import { isHex } from "viem";
import { t } from "../../common";
import { interactionsContext } from "./context";

/**
 * Interactions related routes
 */
export const interactions = new Elysia().use(interactionsContext).get(
    "/interactions/validatorPublicKey",
    async ({ productSignerRepository, query }) => {
        // Case of a product id
        if (query.productId) {
            if (!isHex(query.productId)) {
                throw new Error("Invalid productId");
            }

            const account =
                await productSignerRepository.getProductSpecificAccount({
                    productId: BigInt(query.productId),
                });
            return { pubKey: account.address };
        }

        // Case of a requested type
        if (query.key) {
            const account = await productSignerRepository.getKeySpecificAccount(
                {
                    key: query.key,
                }
            );
            return { pubKey: account.address };
        }

        throw new Error("Invalid query");
    },
    {
        query: t.Object({
            productId: t.Optional(t.Hex()),
            key: t.Optional(t.String()),
        }),
        response: t.Object({
            pubKey: t.Address(),
        }),
    }
);
