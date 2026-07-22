import { log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { CampaignBankContext } from "../../../domain/campaign-bank";
import { MerchantContext } from "../../../domain/merchant";
import { MerchantIdParamSchema } from "../../schemas";
import {
    businessSessionContext,
    StepUpRequired401,
} from "../middleware/session";

export const merchantTransferRoutes = new Elysia({
    prefix: "/:merchantId/transfer",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({ params: { merchantId } }) => {
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
                fromAccountId: transfer.fromAccountId,
                toWallet: transfer.toWallet,
                toAccountId: transfer.toAccountId,
                initiatedAt: transfer.initiatedAt.toISOString(),
                expiresAt: transfer.expiresAt.toISOString(),
            };
        },
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            response: {
                200: t.Union([
                    t.Object({ pending: t.Literal(false) }),
                    t.Object({
                        pending: t.Literal(true),
                        fromWallet: t.Union([t.Hex(), t.Null()]),
                        fromAccountId: t.Union([t.String(), t.Null()]),
                        toWallet: t.Union([t.Hex(), t.Null()]),
                        toAccountId: t.Union([t.String(), t.Null()]),
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
        async ({ params: { merchantId }, body, businessSession, request }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }
            if (!body.toAccountId && !body.toWallet) {
                return status(
                    400,
                    "Either toWallet or toAccountId is required"
                );
            }
            if (body.message && !body.signature) {
                return status(400, "signature is required alongside message");
            }
            const origin = request.headers.get("origin") ?? "";

            await MerchantContext.services.ownershipTransfer.initiateTransfer({
                merchantId,
                actor: {
                    wallet: businessSession.wallet,
                    accountId: businessSession.accountId,
                },
                target: body.toAccountId
                    ? { accountId: body.toAccountId }
                    : { wallet: body.toWallet as `0x${string}` },
                siweProof:
                    body.message && body.signature
                        ? { message: body.message, signature: body.signature }
                        : undefined,
                requestOrigin: origin,
            });
            return status(204);
        },
        {
            // Ownership transfer is a sensitive action (§4.8).
            requireStepUp: true,
            params: MerchantIdParamSchema,
            body: t.Object({
                // Wallet-owned merchants: a fresh SIWE proof (existing flow).
                // Walletless owners: omitted — the step-up-verified session is
                // the proof (§7.5).
                message: t.Optional(t.String()),
                signature: t.Optional(t.Hex()),
                // Exactly one of the two identifies the target.
                toWallet: t.Optional(t.Hex()),
                toAccountId: t.Optional(t.String()),
            }),
            response: {
                204: t.Void(),
                400: t.String(),
                401: StepUpRequired401,
            },
        }
    )
    .post(
        "/accept",
        async ({ params: { merchantId }, body, businessSession, request }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }
            const origin = request.headers.get("origin") ?? "";

            const pendingTransfer =
                await MerchantContext.services.ownershipTransfer.getPendingTransfer(
                    merchantId
                );

            await MerchantContext.services.ownershipTransfer.acceptTransfer({
                merchantId,
                actor: {
                    wallet: businessSession.wallet,
                    accountId: businessSession.accountId,
                },
                siweProof:
                    body.message && body.signature
                        ? { message: body.message, signature: body.signature }
                        : undefined,
                requestOrigin: origin,
            });
            if (pendingTransfer) {
                CampaignBankContext.services.campaignBank
                    .transferBankRoles(
                        merchantId,
                        pendingTransfer.fromWallet,
                        pendingTransfer.toWallet
                    )
                    .catch((error) => {
                        log.error(
                            {
                                merchantId,
                                fromWallet: pendingTransfer.fromWallet,
                                toWallet: pendingTransfer.toWallet,
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : String(error),
                            },
                            "Failed to transfer bank roles after ownership change"
                        );
                    });
            }

            return status(204);
        },
        {
            // Ownership transfer is a sensitive action (§4.8).
            requireStepUp: true,
            params: MerchantIdParamSchema,
            body: t.Object({
                // Wallet transfer target: a fresh SIWE proof (existing flow).
                // Account transfer target: omitted — the target's own
                // step-up-verified session is the proof (§7.5).
                message: t.Optional(t.String()),
                signature: t.Optional(t.Hex()),
            }),
            response: {
                204: t.Void(),
                400: t.String(),
                401: StepUpRequired401,
            },
        }
    )
    .delete(
        "",
        async ({ params: { merchantId }, businessSession }) => {
            if (!businessSession?.wallet && !businessSession?.accountId) {
                return status(401, "Authentication required");
            }

            await MerchantContext.services.ownershipTransfer.cancelTransfer({
                merchantId,
                actor: {
                    wallet: businessSession.wallet,
                    accountId: businessSession.accountId,
                },
            });

            return status(204);
        },
        {
            params: MerchantIdParamSchema,
            response: {
                204: t.Void(),
                400: t.String(),
                401: t.String(),
            },
        }
    )
    .get(
        "/statement/initiate",
        async ({
            params: { merchantId },
            query: { toWallet, toAccountId },
        }) => {
            if (!toAccountId && !toWallet) {
                return status(
                    400,
                    "Either toWallet or toAccountId is required"
                );
            }
            const statement =
                MerchantContext.services.ownershipTransfer.buildInitiateStatement(
                    merchantId,
                    toAccountId
                        ? { accountId: toAccountId }
                        : { wallet: toWallet as `0x${string}` }
                );

            return { statement };
        },
        {
            params: MerchantIdParamSchema,
            query: t.Object({
                toWallet: t.Optional(t.Hex()),
                toAccountId: t.Optional(t.String()),
            }),
            response: {
                200: t.Object({
                    statement: t.String(),
                }),
                400: t.String(),
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
            params: MerchantIdParamSchema,
            response: {
                200: t.Object({
                    statement: t.String(),
                }),
            },
        }
    );
