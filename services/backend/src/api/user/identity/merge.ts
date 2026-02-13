import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";

export const identityMergeRoutes = new Elysia({ prefix: "/merge" })
    .post(
        "/initiate",
        async ({ body }) => {
            const result =
                await OrchestrationContext.orchestrators.anonymousMerge.initiateMerge(
                    {
                        sourceAnonymousId: body.sourceAnonymousId,
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
            body: t.Object({
                sourceAnonymousId: t.String(),
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
