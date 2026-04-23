import { rateLimitMiddleware, sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";

export const identityMergeRoutes = new Elysia({ prefix: "/merge" })
    .use(sessionContext)
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 20 }))
    .post(
        "/initiate",
        async ({ body, walletSession }) => {
            // Wallet session (when the wallet app authenticates) supplies the
            // source wallet identity. Anonymous SDK callers supply
            // `sourceAnonymousId` in the body. At least one is required.
            if (!walletSession && !body.sourceAnonymousId) {
                return status(400, {
                    success: false as const,
                    error: "sourceAnonymousId is required when no wallet session is provided",
                    code: "MISSING_SOURCE_IDENTITY",
                });
            }

            const result =
                await OrchestrationContext.orchestrators.anonymousMerge.initiateMerge(
                    {
                        sourceAnonymousId: body.sourceAnonymousId,
                        sourceWalletAddress: walletSession?.address,
                        merchantId: body.merchantId,
                    }
                );

            if (!result.success) {
                return status(400, {
                    success: false as const,
                    error: result.error,
                    code: result.code,
                });
            }

            return {
                mergeToken: result.mergeToken,
                expiresAt: result.expiresAt.toISOString(),
            };
        },
        {
            // Wallet auth is optional here — anonymous SDK callers still hit
            // this route without a session.
            withOptionalWalletOrSdkAuthent: true,
            body: t.Object({
                sourceAnonymousId: t.Optional(t.String()),
                merchantId: t.String({ format: "uuid" }),
            }),
            response: {
                200: t.Object({
                    mergeToken: t.String(),
                    expiresAt: t.String(),
                }),
                400: t.ErrorResponse,
            },
        }
    )
    .post(
        "/execute",
        async ({ body }) => {
            const result =
                await OrchestrationContext.orchestrators.anonymousMerge.executeMerge(
                    {
                        mergeToken: body.mergeToken,
                        targetAnonymousId: body.targetAnonymousId,
                        merchantId: body.merchantId,
                    }
                );

            if (!result.success) {
                // Use 401 for token-related errors
                const statusCode =
                    result.code === "TOKEN_INVALID" ||
                    result.code === "TOKEN_EXPIRED"
                        ? 401
                        : 400;

                return status(statusCode, {
                    success: false as const,
                    error: result.error,
                    code: result.code,
                });
            }

            return {
                success: true as const,
                finalGroupId: result.finalGroupId,
                merged: result.merged,
            };
        },
        {
            body: t.Object({
                mergeToken: t.String(),
                targetAnonymousId: t.String(),
                merchantId: t.String({ format: "uuid" }),
            }),
            response: {
                200: t.Object({
                    success: t.Literal(true),
                    finalGroupId: t.String({ format: "uuid" }),
                    merged: t.Boolean(),
                }),
                400: t.ErrorResponse,
                401: t.ErrorResponse,
            },
        }
    );
