import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MerchantContext } from "../../../domain/merchant";
import { MerchantIdParamSchema } from "../../schemas";
import {
    businessSessionContext,
    StepUpRequired401,
} from "../middleware/session";

export const merchantAdminsRoutes = new Elysia({
    prefix: "/:merchantId/admins",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({
            params: { merchantId },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const [merchant, admins] = await Promise.all([
                MerchantContext.repositories.merchant.findById(merchantId),
                MerchantContext.repositories.merchantAdmin.findByMerchant(
                    merchantId
                ),
            ]);

            if (!merchant) {
                return status(404, "Merchant not found");
            }

            return {
                admins: [
                    {
                        id: merchant.id,
                        // Walletless owner — wallet is null, identity is the
                        // business account.
                        wallet: merchant.ownerWallet,
                        addedBy: merchant.ownerWallet,
                        addedAt: (
                            merchant.createdAt ?? new Date()
                        ).toISOString(),
                        isOwner: true,
                    },
                    ...admins.map((admin) => ({
                        id: admin.id,
                        wallet: admin.wallet,
                        addedBy: admin.addedBy,
                        addedAt: admin.addedAt.toISOString(),
                        isOwner: false,
                    })),
                ],
            };
        },
        {
            params: MerchantIdParamSchema,
            response: {
                200: t.Object({
                    admins: t.Array(
                        t.Object({
                            id: t.String(),
                            wallet: t.Union([t.Hex(), t.Null()]),
                            addedBy: t.Union([t.Hex(), t.Null()]),
                            addedAt: t.String(),
                            isOwner: t.Boolean(),
                        })
                    ),
                }),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .post(
        "",
        async ({
            params: { merchantId },
            body: { wallet },
            businessSession,
        }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            // `addedBy` records whichever identity the actor holds — wallet
            // for wallet sessions, business account for walletless ones.
            const admin = await MerchantContext.repositories.merchantAdmin.add({
                merchantId,
                wallet,
                addedBy: businessSession.wallet,
                addedByAccountId: businessSession.accountId,
            });

            return {
                id: admin.id,
                wallet: admin.wallet,
                addedBy: admin.addedBy,
                addedAt: admin.addedAt.toISOString(),
            };
        },
        {
            // Admin management is a sensitive action (§4.8).
            requireStepUp: true,
            params: MerchantIdParamSchema,
            body: t.Object({
                wallet: t.Hex(),
            }),
            response: {
                200: t.Object({
                    id: t.String(),
                    wallet: t.Union([t.Hex(), t.Null()]),
                    addedBy: t.Union([t.Hex(), t.Null()]),
                    addedAt: t.String(),
                }),
                401: StepUpRequired401,
                403: t.String(),
            },
        }
    )
    .delete(
        "/:wallet",
        async ({
            params: { merchantId, wallet },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const removed =
                await MerchantContext.repositories.merchantAdmin.remove(
                    merchantId,
                    wallet
                );

            if (!removed) {
                return status(404, "Admin not found");
            }

            return status(204);
        },
        {
            // Admin management is a sensitive action (§4.8).
            requireStepUp: true,
            params: t.Object({
                merchantId: t.String(),
                wallet: t.Hex(),
            }),
            response: {
                204: t.Void(),
                401: StepUpRequired401,
                403: t.String(),
                404: t.String(),
            },
        }
    );
