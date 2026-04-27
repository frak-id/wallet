import { rateLimitMiddleware, sessionContext } from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
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
                throw HttpError.badRequest(
                    "MISSING_SOURCE_IDENTITY",
                    "sourceAnonymousId is required when no wallet session is provided"
                );
            }

            const result =
                await OrchestrationContext.orchestrators.anonymousMerge.initiateMerge(
                    {
                        sourceAnonymousId: body.sourceAnonymousId,
                        sourceWalletAddress: walletSession?.address,
                        merchantId: body.merchantId,
                    }
                );

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
