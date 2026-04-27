import { identityContext, rateLimitMiddleware } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { ReferralCodeContext } from "../../../../domain/referral-code/context";
import { OrchestrationContext } from "../../../../orchestration/context";

// Single shared rate limit for all /code/* routes: per-IP (DDoS defence)
// + per-identity (prevents a single user fanning out across networks).
// Identity bucket reads `identityGroupId` resolved by `identityContext`.
// biome-ignore lint/suspicious/noExplicitAny: Elysia's scoped-plugin context type does not carry plugin-resolved fields through to `onBeforeHandle`.
const identityKey = (ctx: any): string | null => {
    const id = ctx.identityGroupId as string | null | undefined;
    return id ? `identity:${id}` : null;
};

export const referralCodeRoutes = new Elysia({ prefix: "/code" })
    .use(identityContext)
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .use(
        rateLimitMiddleware({
            windowMs: 60_000,
            maxRequests: 10,
            keyExtractor: identityKey,
        })
    )
    .post(
        "/issue",
        async ({ identityGroupId, body }) => {
            // `withAuthedIdentity` guarantees identityGroupId is set.
            if (!identityGroupId) return status(401, "Unauthorized");
            const result =
                await ReferralCodeContext.services.referralCode.issue({
                    ownerIdentityGroupId: identityGroupId,
                    preferredCode: body?.code,
                });

            if (!result.success) {
                // ALREADY_ACTIVE / CODE_UNAVAILABLE — both are conflicts on
                // the same underlying resource. Validation failures on a
                // user-supplied code are 400.
                const statusCode =
                    result.code === "INVALID_CODE_LENGTH" ||
                    result.code === "INVALID_CODE_CHARS"
                        ? 400
                        : 409;
                return status(statusCode, {
                    success: false as const,
                    error: result.error,
                    code: result.code,
                });
            }

            return {
                code: result.code.code,
                createdAt: result.code.createdAt.toISOString(),
            };
        },
        {
            withAuthedIdentity: true,
            body: t.Optional(
                t.Object({
                    code: t.Optional(
                        t.String({
                            minLength: 6,
                            maxLength: 6,
                        })
                    ),
                })
            ),
            response: {
                401: t.String(),
                429: t.String(),
                200: t.Object({
                    code: t.String(),
                    createdAt: t.String(),
                }),
                400: t.ErrorResponse,
                409: t.ErrorResponse,
            },
        }
    )
    .delete(
        "",
        async ({ identityGroupId }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            await ReferralCodeContext.services.referralCode.revoke({
                ownerIdentityGroupId: identityGroupId,
            });
            return status(204);
        },
        {
            withAuthedIdentity: true,
            response: {
                401: t.String(),
                429: t.String(),
                204: t.Void(),
            },
        }
    )
    .post(
        "/redeem",
        async ({ identityGroupId, body }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            const result =
                await OrchestrationContext.orchestrators.referralCodeRedemption.redeem(
                    {
                        code: body.code,
                        refereeIdentityGroupId: identityGroupId,
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
                success: true as const,
            };
        },
        {
            withAuthedIdentity: true,
            body: t.Object({
                code: t.String({ minLength: 6, maxLength: 6 }),
            }),
            response: {
                401: t.String(),
                429: t.String(),
                200: t.Object({
                    success: t.Literal(true),
                }),
                400: t.ErrorResponse,
            },
        }
    )
    .get(
        "/suggest",
        async ({ query }) => {
            const result =
                await ReferralCodeContext.services.referralCode.suggestWithStem(
                    {
                        stem: query.stem,
                        count: query.count,
                    }
                );

            if (!result.success) {
                return status(400, {
                    success: false as const,
                    error: result.error,
                    code: result.code,
                });
            }

            return { suggestions: result.suggestions };
        },
        {
            withAuthedIdentity: true,
            query: t.Object({
                stem: t.String({ minLength: 3, maxLength: 4 }),
                count: t.Optional(
                    t.Number({ minimum: 1, maximum: 20, default: 10 })
                ),
            }),
            response: {
                401: t.String(),
                429: t.String(),
                200: t.Object({
                    suggestions: t.Array(t.String()),
                }),
                400: t.ErrorResponse,
            },
        }
    );
