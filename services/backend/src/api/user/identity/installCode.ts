import {
    log,
    rateLimitMiddleware,
    sessionContext,
} from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { IdentityContext } from "../../../domain/identity/context";
import { MerchantContext } from "../../../domain/merchant/context";
import { OrchestrationContext } from "../../../orchestration/context";

const installCodeGenerateRoute = new Elysia()
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 5 }))
    .post(
        "/generate",
        async ({ body }) => {
            const result = await IdentityContext.services.installCode.generate({
                merchantId: body.merchantId,
                anonymousId: body.anonymousId,
            });

            return {
                code: result.code,
                expiresAt: new Date(result.expiresAt).toISOString(),
            };
        },
        {
            body: t.Object({
                merchantId: t.String({ format: "uuid" }),
                anonymousId: t.String(),
            }),
            response: {
                200: t.Object({
                    code: t.String(),
                    expiresAt: t.String(),
                }),
            },
        }
    );

const installCodeResolveRoute = new Elysia()
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .post(
        "/resolve",
        async ({ body }) => {
            const result = await IdentityContext.services.installCode.resolve({
                code: body.code,
            });

            if (!result.success) {
                return status(400, {
                    success: false as const,
                    error: result.error,
                    code: result.code,
                });
            }

            const [merchant, identityGroup] = await Promise.all([
                MerchantContext.repositories.merchant.findById(
                    result.merchantId
                ),
                IdentityContext.repositories.identity.findGroupByIdentity({
                    type: "anonymous_fingerprint",
                    value: result.anonymousId,
                    merchantId: result.merchantId,
                }),
            ]);

            if (!merchant) {
                return status(400, {
                    success: false as const,
                    error: "Merchant not found",
                    code: "MERCHANT_NOT_FOUND",
                });
            }

            let hasWallet = false;
            if (identityGroup) {
                const wallet =
                    await IdentityContext.repositories.identity.getWalletForGroup(
                        identityGroup.id
                    );
                hasWallet = wallet !== null;
            }

            return {
                merchantId: result.merchantId,
                anonymousId: result.anonymousId,
                merchant: {
                    name: merchant.name,
                    domain: merchant.domain,
                },
                hasWallet,
            };
        },
        {
            body: t.Object({
                code: t.String(),
            }),
            response: {
                200: t.Object({
                    merchantId: t.String(),
                    anonymousId: t.String(),
                    merchant: t.Object({
                        name: t.String(),
                        domain: t.String(),
                    }),
                    hasWallet: t.Boolean(),
                }),
                400: t.ErrorResponse,
            },
        }
    );

const installCodeConsumeRoute = new Elysia()
    .use(sessionContext)
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .post(
        "/consume",
        async ({ body, walletSession }) => {
            const walletAddress = walletSession.address;

            const consumeResult =
                await IdentityContext.services.installCode.consume({
                    code: body.code,
                    onConsume: async ({ merchantId, anonymousId }) => {
                        const mergeResult =
                            await OrchestrationContext.orchestrators.identity.resolveAndAssociate(
                                [
                                    { type: "wallet", value: walletAddress },
                                    {
                                        type: "anonymous_fingerprint",
                                        value: anonymousId,
                                        merchantId,
                                    },
                                ]
                            );

                        log.info(
                            {
                                walletAddress,
                                merchantId,
                                anonymousId,
                                ...mergeResult,
                            },
                            "Install code consumed"
                        );

                        return mergeResult;
                    },
                });

            if (!consumeResult.success) {
                return status(400, {
                    success: false as const,
                    error: consumeResult.error,
                    code: consumeResult.code,
                });
            }

            return {
                success: true as const,
                finalGroupId: consumeResult.result.finalGroupId,
                merged: consumeResult.result.merged,
            };
        },
        {
            withWalletAuthent: true,
            body: t.Object({
                code: t.String(),
            }),
            response: {
                200: t.Object({
                    success: t.Literal(true),
                    finalGroupId: t.String({ format: "uuid" }),
                    merged: t.Boolean(),
                }),
                400: t.ErrorResponse,
                401: t.String(),
            },
        }
    );

export const installCodeRoutes = new Elysia({ prefix: "/install-code" })
    .use(installCodeGenerateRoute)
    .use(installCodeResolveRoute)
    .use(installCodeConsumeRoute);
