import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AffiliateContext } from "../../../domain/affiliate";
import { identityContext } from "../../middleware/identity";

const shareLinkSchema = t.Object({
    provider: t.Literal("takeads"),
    token: t.String(),
    url: t.String(),
});

/**
 * Affiliate share links for explorer items flagged `integration: "affiliate"`
 * (see ExplorerOrchestrator) — the native counterpart is appending `fCtx` to
 * the merchant domain client-side.
 *
 * The wallet drives a lazy two-step flow:
 *  - `GET  /:merchantId/link` returns the caller's existing link, or `null` if
 *    they haven't created one yet (no minting — read-only).
 *  - `POST /:merchantId/link` mints (or reuses) the link on explicit user action.
 *
 * The attribution token is bound server-side to the caller's identity group,
 * so the link is non-forgeable and stable across re-shares.
 */
export const userAffiliateApi = new Elysia({ prefix: "/affiliate" })
    .use(identityContext)
    .get(
        "/:merchantId/link",
        async ({ identityGroupId, params: { merchantId } }) => {
            if (!identityGroupId) return status(401, "Unauthorized");

            return AffiliateContext.services.affiliateLink.getShareLink({
                merchantId,
                identityGroupId,
            });
        },
        {
            withAuthedIdentity: true,
            params: t.Object({
                merchantId: t.String({ format: "uuid" }),
            }),
            response: {
                200: t.Nullable(shareLinkSchema),
                401: t.String(),
                404: t.ErrorResponse,
            },
        }
    )
    .post(
        "/:merchantId/link",
        async ({ identityGroupId, params: { merchantId } }) => {
            if (!identityGroupId) return status(401, "Unauthorized");

            return AffiliateContext.services.affiliateLink.getOrCreateShareLink(
                {
                    merchantId,
                    identityGroupId,
                }
            );
        },
        {
            withAuthedIdentity: true,
            params: t.Object({
                merchantId: t.String({ format: "uuid" }),
            }),
            response: {
                200: shareLinkSchema,
                401: t.String(),
                404: t.ErrorResponse,
            },
        }
    );
