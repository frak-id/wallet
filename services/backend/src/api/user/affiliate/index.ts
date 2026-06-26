import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AffiliateContext } from "../../../domain/affiliate";
import { identityContext } from "../../middleware/identity";

/**
 * Mints (or reuses) the authenticated wallet's affiliate share link for a
 * merchant. The wallet calls this for explorer items flagged
 * `integration: "affiliate"` (see ExplorerOrchestrator) — the native
 * counterpart is appending `fCtx` to the merchant domain client-side.
 *
 * The attribution token is bound server-side to the caller's identity group,
 * so the link is non-forgeable and stable across re-shares.
 */
export const userAffiliateApi = new Elysia({ prefix: "/affiliate" })
    .use(identityContext)
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
                200: t.Object({
                    provider: t.Literal("takeads"),
                    token: t.String(),
                    url: t.String(),
                }),
                401: t.String(),
                404: t.ErrorResponse,
            },
        }
    );
