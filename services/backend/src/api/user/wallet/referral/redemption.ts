import { identityContext, rateLimitMiddleware } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AttributionContext } from "../../../../domain/attribution";

// Per-IP and per-identity rate limits, mirroring `/code/*`. Removing a
// referrer is a write that's even less hot than redeeming, but we still want
// the per-identity bucket to prevent a single user fanning out across IPs.
// biome-ignore lint/suspicious/noExplicitAny: Elysia's scoped-plugin context type does not carry plugin-resolved fields through to `onBeforeHandle`.
const identityKey = (ctx: any): string | null => {
    const id = ctx.identityGroupId as string | null | undefined;
    return id ? `identity:${id}` : null;
};

/**
 * Soft-delete the caller's active referrer for the given scope.
 *
 *  - Omitted `merchantId` ⇒ revoke the cross-merchant referrer (typically
 *    the one created by redeeming a referral code in wallet settings).
 *  - Provided `merchantId` ⇒ revoke the per-merchant referrer (typically
 *    the one created by clicking a shared link for that merchant).
 *
 * The underlying `referral_links` row is preserved with `removed_at` set
 * and `end_reason='removed'` so analytics, identity-merge cleanup, and
 * `asset_logs.referral_link_id` history all stay intact. After this call,
 * the user can pick up a new referrer (redeem a different code, click
 * another share link) and a fresh row will be inserted.
 *
 * Returns 204 on success or 404 when there's no active referrer to revoke.
 */
export const referralRedemptionRoutes = new Elysia({ prefix: "/redemption" })
    .use(identityContext)
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 10 }))
    .use(
        rateLimitMiddleware({
            windowMs: 60_000,
            maxRequests: 10,
            keyExtractor: identityKey,
        })
    )
    .delete(
        "",
        async ({ identityGroupId, query }) => {
            if (!identityGroupId) return status(401, "Unauthorized");

            const merchantId = query.merchantId ?? null;
            await AttributionContext.services.referral.removeReferrer({
                merchantId,
                refereeIdentityGroupId: identityGroupId,
                scope: merchantId ? "merchant" : "cross_merchant",
                reason: "removed",
            });

            return status(204);
        },
        {
            withAuthedIdentity: true,
            query: t.Object({
                merchantId: t.Optional(t.String({ format: "uuid" })),
            }),
            response: {
                401: t.String(),
                404: t.String(),
                429: t.String(),
                204: t.Void(),
            },
        }
    );
