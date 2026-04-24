import {
    createIdentityRateLimit,
    rateLimitMiddleware,
    sessionContext,
} from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { ReferralCodeContext } from "../../../../domain/referral-code/context";
import { OrchestrationContext } from "../../../../orchestration/context";
import { resolveWalletIdentityGroup } from "./identity";

// Per-identity rate limits — complement the IP-based limits below so that a
// single user cannot burn through budget across different networks. Tuned
// for genuine user actions; not a DDoS defence (IP limits cover that).
const issueIdentityLimit = createIdentityRateLimit({
    windowMs: 60 * 60_000,
    maxRequests: 5,
});
const revokeIdentityLimit = createIdentityRateLimit({
    windowMs: 60 * 60_000,
    maxRequests: 5,
});
const redeemIdentityLimit = createIdentityRateLimit({
    windowMs: 60 * 60_000,
    maxRequests: 5,
});
const suggestIdentityLimit = createIdentityRateLimit({
    windowMs: 60 * 60_000,
    maxRequests: 20,
});

const tooManyRequests = () => status(429, "Too Many Requests");

const getActiveRoute = new Elysia().use(sessionContext).get(
    "",
    async ({ walletSession }) => {
        const ownerIdentityGroupId = await resolveWalletIdentityGroup(
            walletSession.address
        );
        const active =
            await ReferralCodeContext.services.referralCode.findActiveByOwner(
                ownerIdentityGroupId
            );

        return {
            code: active?.code ?? null,
            createdAt: active?.createdAt.toISOString() ?? null,
        };
    },
    {
        withWalletAuthent: true,
        response: {
            401: t.String(),
            200: t.Object({
                code: t.Union([t.String(), t.Null()]),
                createdAt: t.Union([t.String(), t.Null()]),
            }),
        },
    }
);

const issueRoute = new Elysia()
    .use(sessionContext)
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 5 }))
    .post(
        "/issue",
        async ({ walletSession, body }) => {
            const ownerIdentityGroupId = await resolveWalletIdentityGroup(
                walletSession.address
            );
            if (!issueIdentityLimit.consume(ownerIdentityGroupId)) {
                return tooManyRequests();
            }

            const result =
                await ReferralCodeContext.services.referralCode.issue({
                    ownerIdentityGroupId,
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
            withWalletAuthent: true,
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
    );

const revokeRoute = new Elysia()
    .use(sessionContext)
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 5 }))
    .delete(
        "",
        async ({ walletSession }) => {
            const ownerIdentityGroupId = await resolveWalletIdentityGroup(
                walletSession.address
            );
            if (!revokeIdentityLimit.consume(ownerIdentityGroupId)) {
                return tooManyRequests();
            }
            await ReferralCodeContext.services.referralCode.revoke({
                ownerIdentityGroupId,
            });
            return status(204);
        },
        {
            withWalletAuthent: true,
            response: {
                401: t.String(),
                429: t.String(),
                204: t.Void(),
            },
        }
    );

// Redemption is a write that affects a globally-unique row; pair a
// moderate per-IP bucket with a tight per-identity bucket.
const redeemRoute = new Elysia()
    .use(sessionContext)
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .post(
        "/redeem",
        async ({ walletSession, body }) => {
            const refereeIdentityGroupId = await resolveWalletIdentityGroup(
                walletSession.address
            );
            if (!redeemIdentityLimit.consume(refereeIdentityGroupId)) {
                return tooManyRequests();
            }

            const result =
                await OrchestrationContext.orchestrators.referralCodeRedemption.redeem(
                    {
                        code: body.code,
                        refereeIdentityGroupId,
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
            withWalletAuthent: true,
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
    );

// Personalised-code helper: user types a 3-4 char stem, server proposes
// available 6-char codes containing it (digit-fill preferred, random start
// or end placement). Read-ish but exposes availability state of a tiny
// slice of the namespace, so still rate-limited.
const suggestRoute = new Elysia()
    .use(sessionContext)
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .get(
        "/suggest",
        async ({ walletSession, query }) => {
            const identityGroupId = await resolveWalletIdentityGroup(
                walletSession.address
            );
            if (!suggestIdentityLimit.consume(identityGroupId)) {
                return tooManyRequests();
            }

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
            withWalletAuthent: true,
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

export const referralCodeRoutes = new Elysia({ prefix: "/code" })
    .use(getActiveRoute)
    .use(issueRoute)
    .use(revokeRoute)
    .use(redeemRoute)
    .use(suggestRoute);
