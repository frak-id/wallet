import { onChainRolesRepository } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { productRoles } from "@frak-labs/app-essentials";
import { Elysia, status } from "elysia";
import { toHex } from "viem";
import { businessSessionContext } from "../middleware/session";

export const rolesRoutes = new Elysia({ prefix: "/roles" })
    .use(businessSessionContext)
    .get(
        "/",
        async ({
            query: { wallet: initialWallet, productId },
            businessSession,
        }) => {
            if (!productId) {
                return status(400, "Invalid product id");
            }
            if (!businessSession) {
                return status(401, "Unauthorized");
            }

            const wallet = initialWallet ?? businessSession.wallet;
            if (!wallet) {
                return status(400, "Invalid wallet");
            }

            // Fetch the roles
            const { isOwner, roles } =
                await onChainRolesRepository.getRolesOnProduct({
                    wallet,
                    productId: BigInt(productId),
                });

            // Map them to a redeable format
            return {
                isOwner,
                roles: toHex(roles),
                isAdministrator:
                    isOwner ||
                    onChainRolesRepository.hasRolesOrAdmin({
                        onChainRoles: roles,
                        role: productRoles.productAdministrator,
                    }),
                isInteractionManager:
                    isOwner ||
                    onChainRolesRepository.hasRolesOrAdmin({
                        onChainRoles: roles,
                        role: productRoles.interactionManager,
                    }),
                isCampaignManager:
                    isOwner ||
                    onChainRolesRepository.hasRolesOrAdmin({
                        onChainRoles: roles,
                        role: productRoles.campaignManager,
                    }),
            };
        },
        {
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
