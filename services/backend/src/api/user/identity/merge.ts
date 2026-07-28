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
                        proof: body.proof,
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
                // frak-merge-v1 proof binding sourceAnonymousId (README §4.2).
                // Required whenever sourceAnonymousId is supplied (Phase 4a).
                proof: t.Optional(t.String()),
            }),
            response: {
                200: t.Object({
                    mergeToken: t.String(),
                    expiresAt: t.String(),
                }),
                400: t.ErrorResponse,
                // PROOF_REQUIRED (sourceAnonymousId with no/absent proof) or
                // PROOF_INVALID (proof present but fails verification).
                403: t.ErrorResponse,
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
                        proof: body.proof,
                    }
                );

            return {
                finalGroupId: result.finalGroupId,
                merged: result.merged,
            };
        },
        {
            body: t.Object({
                mergeToken: t.String(),
                targetAnonymousId: t.String(),
                merchantId: t.String({ format: "uuid" }),
                // frak-merge-v1 proof binding targetAnonymousId and
                // SHA-256(mergeToken) (README §2.2, §4.3). Required only once
                // targetAnonymousId has previously proven itself (Phase 4a
                // latch); unlatched/legacy ids keep working without one.
                proof: t.Optional(t.String()),
            }),
            response: {
                200: t.Object({
                    finalGroupId: t.String({ format: "uuid" }),
                    merged: t.Boolean(),
                }),
                400: t.ErrorResponse,
                401: t.ErrorResponse,
                // PROOF_REQUIRED (latched targetAnonymousId with no proof) or
                // PROOF_INVALID (proof present but fails verification).
                403: t.ErrorResponse,
            },
        }
    );
