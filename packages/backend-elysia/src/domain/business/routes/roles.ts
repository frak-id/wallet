import { blockchainContext, nextSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import { productRoles } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { toHex } from "viem";

export const rolesRoutes = new Elysia({ prefix: "/roles" })
    .use(nextSessionContext)
    .use(blockchainContext)
    .get(
        "/",
        async ({
            query: { wallet: initialWallet, productId },
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

            const wallet = initialWallet ?? businessSession.wallet;
            if (!wallet) {
                return error(400, "Invalid wallet");
            }

            // Fetch the roles
            const { isOwner, roles } = await rolesRepository.getRolesOnProduct({
                wallet,
                productId: BigInt(productId),
            });

            // Map them to a redeable format
            return {
                isOwner,
                roles: toHex(roles),
                isAdministrator:
                    isOwner ||
                    rolesRepository.hasRolesOrAdmin({
                        onChainRoles: roles,
                        role: productRoles.productAdministrator,
                    }),
                isInteractionManager:
                    isOwner ||
                    rolesRepository.hasRolesOrAdmin({
                        onChainRoles: roles,
                        role: productRoles.interactionManager,
                    }),
                isCampaignManager:
                    isOwner ||
                    rolesRepository.hasRolesOrAdmin({
                        onChainRoles: roles,
                        role: productRoles.campaignManager,
                    }),
            };
        },
        {
            nextAuthenticated: "business",
            query: t.Object({
                wallet: t.Optional(t.Address()),
                productId: t.Optional(t.Hex()),
            }),
            response: {
                404: t.String(),
                401: t.String(),
                400: t.String(),
                200: t.Object({
                    roles: t.Hex(),
                    isOwner: t.Boolean(),
                    isAdministrator: t.Boolean(),
                    isInteractionManager: t.Boolean(),
                    isCampaignManager: t.Boolean(),
                }),
            },
        }
    );
