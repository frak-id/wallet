import { rateLimitMiddleware, sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import type { Address } from "viem";
import { AttributionContext } from "../../../../domain/attribution/context";
import { ReferralCodeContext } from "../../../../domain/referral-code/context";
import { OrchestrationContext } from "../../../../orchestration/context";

/**
 * Resolve the caller's identity group from their wallet session. The wallet
 * is authenticated, so a group is expected to exist (created during register
 * / login). `resolve` is idempotent and creates the group on the rare path
 * where it does not yet exist.
 */
async function resolveOwnerGroupId(walletAddress: Address): Promise<string> {
    const { groupId } =
        await OrchestrationContext.orchestrators.identity.resolve({
            type: "wallet",
            value: walletAddress,
        });
    return groupId;
}

const getActiveRoute = new Elysia().use(sessionContext).get(
    "",
    async ({ walletSession }) => {
        const ownerIdentityGroupId = await resolveOwnerGroupId(
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
        async ({ walletSession }) => {
            const ownerIdentityGroupId = await resolveOwnerGroupId(
                walletSession.address
            );
            const result =
                await ReferralCodeContext.services.referralCode.issue({
                    ownerIdentityGroupId,
                });

            if (!result.success) {
                return status(409, {
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
            response: {
                401: t.String(),
                200: t.Object({
                    code: t.String(),
                    createdAt: t.String(),
                }),
                409: t.ErrorResponse,
            },
        }
    );

const rotateRoute = new Elysia()
    .use(sessionContext)
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 5 }))
    .post(
        "/rotate",
        async ({ walletSession }) => {
            const ownerIdentityGroupId = await resolveOwnerGroupId(
                walletSession.address
            );
            const result =
                await ReferralCodeContext.services.referralCode.rotate({
                    ownerIdentityGroupId,
                });

            if (!result.success) {
                return status(400, {
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
            response: {
                401: t.String(),
                200: t.Object({
                    code: t.String(),
                    createdAt: t.String(),
                }),
                400: t.ErrorResponse,
            },
        }
    );

const revokeRoute = new Elysia()
    .use(sessionContext)
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 5 }))
    .delete(
        "",
        async ({ walletSession }) => {
            const ownerIdentityGroupId = await resolveOwnerGroupId(
                walletSession.address
            );
            await ReferralCodeContext.services.referralCode.revoke({
                ownerIdentityGroupId,
            });
            return status(204);
        },
        {
            withWalletAuthent: true,
            response: {
                401: t.String(),
                204: t.Void(),
            },
        }
    );

const redeemRoute = new Elysia()
    .use(sessionContext)
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .post(
        "/redeem",
        async ({ walletSession, body }) => {
            const refereeIdentityGroupId = await resolveOwnerGroupId(
                walletSession.address
            );
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
                200: t.Object({
                    success: t.Literal(true),
                }),
                400: t.ErrorResponse,
            },
        }
    );

const statusRoute = new Elysia().use(sessionContext).get(
    "/status",
    async ({ walletSession }) => {
        const refereeIdentityGroupId = await resolveOwnerGroupId(
            walletSession.address
        );
        // Only surfaces the cross-merchant referrer — merchant-scoped
        // attribution has a dedicated `/user/merchant/referral-status`
        // endpoint.
        const link =
            await AttributionContext.repositories.referralLink.findByReferee({
                merchantId: null,
                refereeIdentityGroupId,
                scope: "cross_merchant",
            });

        return {
            hasReferrer: link !== null,
        };
    },
    {
        withWalletAuthent: true,
        response: {
            401: t.String(),
            200: t.Object({
                hasReferrer: t.Boolean(),
            }),
        },
    }
);

export const referralCodeRoutes = new Elysia({ prefix: "/referral-code" })
    .use(getActiveRoute)
    .use(issueRoute)
    .use(rotateRoute)
    .use(revokeRoute)
    .use(redeemRoute)
    .use(statusRoute);
