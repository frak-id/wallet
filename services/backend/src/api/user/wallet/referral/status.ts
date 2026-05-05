import { identityContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AttributionContext } from "../../../../domain/attribution/context";
import { ReferralCodeContext } from "../../../../domain/referral-code/context";

/**
 * Global referral status for the authenticated wallet. One-stop shop for
 * the wallet settings UI to render both the "you are an influencer" panel
 * (own code) AND the "you were referred by" panel (merchant + cross-merchant).
 *
 * `merchantId` is optional: when provided, merchant-scoped referrer info is
 * included; without it, only the cross-merchant referrer (and the owned
 * code) are returned.
 */
export const referralStatusRoute = new Elysia().use(identityContext).get(
    "/status",
    async ({ identityGroupId, query }) => {
        if (!identityGroupId) return status(401, "Unauthorized");
        const [ownedCode, crossMerchantLink, merchantLink] = await Promise.all([
            ReferralCodeContext.services.referralCode.findActiveByOwner(
                identityGroupId
            ),
            AttributionContext.repositories.referralLink.findByReferee({
                merchantId: null,
                refereeIdentityGroupId: identityGroupId,
                scope: "cross_merchant",
            }),
            query.merchantId
                ? AttributionContext.repositories.referralLink.findByReferee({
                      merchantId: query.merchantId,
                      refereeIdentityGroupId: identityGroupId,
                      scope: "merchant",
                  })
                : Promise.resolve(null),
        ]);

        // Resolve the 6-char code string for code-redemption referrers.
        // `source='link'` referrers (shared-link clicks) carry no code.
        // `findById` skips the `revoked_at` filter so a referrer who has
        // since rotated their code still renders the original string.
        const [crossMerchantCode, merchantCode] = await Promise.all([
            crossMerchantLink?.sourceData?.type === "code"
                ? ReferralCodeContext.repositories.referralCode.findById(
                      crossMerchantLink.sourceData.codeId
                  )
                : Promise.resolve(null),
            merchantLink?.sourceData?.type === "code"
                ? ReferralCodeContext.repositories.referralCode.findById(
                      merchantLink.sourceData.codeId
                  )
                : Promise.resolve(null),
        ]);

        return {
            ownedCode: ownedCode
                ? {
                      code: ownedCode.code,
                      createdAt: ownedCode.createdAt.toISOString(),
                  }
                : null,
            crossMerchantReferrer: crossMerchantLink
                ? {
                      code: crossMerchantCode?.code ?? null,
                      since: crossMerchantLink.createdAt.toISOString(),
                  }
                : null,
            merchantReferrer: merchantLink?.merchantId
                ? {
                      code: merchantCode?.code ?? null,
                      merchantId: merchantLink.merchantId,
                      since: merchantLink.createdAt.toISOString(),
                  }
                : null,
        };
    },
    {
        withAuthedIdentity: true,
        query: t.Object({
            merchantId: t.Optional(t.String({ format: "uuid" })),
        }),
        response: {
            401: t.String(),
            200: t.Object({
                ownedCode: t.Union([
                    t.Object({
                        code: t.String(),
                        createdAt: t.String(),
                    }),
                    t.Null(),
                ]),
                crossMerchantReferrer: t.Union([
                    t.Object({
                        code: t.Union([t.String(), t.Null()]),
                        since: t.String(),
                    }),
                    t.Null(),
                ]),
                merchantReferrer: t.Union([
                    t.Object({
                        code: t.Union([t.String(), t.Null()]),
                        merchantId: t.String(),
                        since: t.String(),
                    }),
                    t.Null(),
                ]),
            }),
        },
    }
);
