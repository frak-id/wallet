import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MerchantContext } from "../../../../domain/merchant";
import { businessSessionContext } from "../../middleware/session";

export const merchantTransferRoutes = new Elysia({
    prefix: "/:merchantId/transfer",
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

            const transfer =
                await MerchantContext.services.ownershipTransfer.getPendingTransfer(
                    merchantId
                );

            if (!transfer) {
                return { pending: false as const };
            }

            return {
                pending: true as const,
                fromWallet: transfer.fromWallet,
                toWallet: transfer.toWallet,
                initiatedAt: transfer.initiatedAt.toISOString(),
                expiresAt: transfer.expiresAt.toISOString(),
            };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            response: {
                200: t.Union([
                    t.Object({ pending: t.Literal(false) }),
                    t.Object({
                        pending: t.Literal(true),
                        fromWallet: t.Hex(),
                        toWallet: t.Hex(),
                        initiatedAt: t.String(),
                        expiresAt: t.String(),
                    }),
                ]),
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .post(
        "/initiate",
        async ({ params: { merchantId }, body, request }) => {
            const origin = request.headers.get("origin") ?? "";

            const result =
                await MerchantContext.services.ownershipTransfer.initiateTransfer(
                    {
                        merchantId,
                        message: body.message,
                        signature: body.signature,
                        toWallet: body.toWallet,
                        requestOrigin: origin,
                    }
                );

            if (!result.success) {
                return status(400, result.error);
            }

            return { success: true };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            body: t.Object({
                message: t.String(),
                signature: t.Hex(),
                toWallet: t.Hex(),
            }),
            response: {
                200: t.Object({
                    success: t.Boolean(),
                }),
                400: t.String(),
            },
        }
    )
    .post(
        "/accept",
        async ({ params: { merchantId }, body, request }) => {
            const origin = request.headers.get("origin") ?? "";

            const result =
                await MerchantContext.services.ownershipTransfer.acceptTransfer(
                    {
                        merchantId,
                        message: body.message,
                        signature: body.signature,
                        requestOrigin: origin,
                    }
                );

            if (!result.success) {
                return status(400, result.error);
            }

            return { success: true };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            body: t.Object({
                message: t.String(),
                signature: t.Hex(),
            }),
            response: {
                200: t.Object({
                    success: t.Boolean(),
                }),
                400: t.String(),
            },
        }
    )
    .delete(
        "",
        async ({ params: { merchantId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const result =
                await MerchantContext.services.ownershipTransfer.cancelTransfer(
                    {
                        merchantId,
                        wallet: businessSession.wallet,
                    }
                );

            if (!result.success) {
                return status(400, result.error);
            }

            return { success: true };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            response: {
                200: t.Object({
                    success: t.Boolean(),
                }),
                400: t.String(),
                401: t.String(),
            },
        }
    )
    .get(
        "/statement/initiate",
        async ({ params: { merchantId }, query: { toWallet } }) => {
            const statement =
                MerchantContext.services.ownershipTransfer.buildInitiateStatement(
                    merchantId,
                    toWallet
                );

            return { statement };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            query: t.Object({
                toWallet: t.Hex(),
            }),
            response: {
                200: t.Object({
                    statement: t.String(),
                }),
            },
        }
    )
    .get(
        "/statement/accept",
        async ({ params: { merchantId } }) => {
            const statement =
                MerchantContext.services.ownershipTransfer.buildAcceptStatement(
                    merchantId
                );

            return { statement };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            response: {
                200: t.Object({
                    statement: t.String(),
                }),
            },
        }
    );
