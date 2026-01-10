import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MerchantContext } from "../../../../domain/merchant";
import { businessSessionContext } from "../../middleware/session";

export const merchantAdminsRoutes = new Elysia({
    prefix: "/:merchantId/admins",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({ params: { merchantId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const admins =
                await MerchantContext.repositories.merchantAdmin.findByMerchant(
                    merchantId
                );

            return {
                admins: admins.map((admin) => ({
                    id: admin.id,
                    wallet: admin.wallet,
                    addedBy: admin.addedBy,
                    addedAt: admin.addedAt.toISOString(),
                })),
            };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            response: {
                200: t.Object({
                    admins: t.Array(
                        t.Object({
                            id: t.String(),
                            wallet: t.Hex(),
                            addedBy: t.Hex(),
                            addedAt: t.String(),
                        })
                    ),
                }),
                401: t.String(),
                403: t.String(),
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
                    businessSession.wallet
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const admin = await MerchantContext.repositories.merchantAdmin.add({
                merchantId,
                wallet,
                addedBy: businessSession.wallet,
            });

            return {
                id: admin.id,
                wallet: admin.wallet,
                addedBy: admin.addedBy,
                addedAt: admin.addedAt.toISOString(),
            };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            body: t.Object({
                wallet: t.Hex(),
            }),
            response: {
                200: t.Object({
                    id: t.String(),
                    wallet: t.Hex(),
                    addedBy: t.Hex(),
                    addedAt: t.String(),
                }),
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .delete(
        "/:wallet",
        async ({ params: { merchantId, wallet }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession.wallet
                );
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

            return { success: true };
        },
        {
            params: t.Object({
                merchantId: t.String(),
                wallet: t.Hex(),
            }),
            response: {
                200: t.Object({
                    success: t.Boolean(),
                }),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
