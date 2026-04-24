import { sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { AttributionContext } from "../../../../domain/attribution/context";
import { ReferralCodeContext } from "../../../../domain/referral-code/context";
import { resolveWalletIdentityGroup } from "./identity";

/**
 * Global referral status for the authenticated wallet. One-stop shop for
 * the wallet settings UI to render both the "you are an influencer" panel
 * (own code) AND the "you were referred by" panel (merchant + cross-merchant).
 *
 * `merchantId` is optional: when provided, merchant-scoped referrer info is
 * included; without it, only the cross-merchant referrer (and the owned
 * code) are returned.
 */
export const referralStatusRoute = new Elysia().use(sessionContext).get(
    "/status",
    async ({ walletSession, query }) => {
        const identityGroupId = await resolveWalletIdentityGroup(
            walletSession.address
        );

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

        return {
            ownedCode: ownedCode
                ? {
                      code: ownedCode.code,
                      createdAt: ownedCode.createdAt.toISOString(),
                  }
                : null,
            crossMerchantReferrer: crossMerchantLink
                ? {
                      since: crossMerchantLink.createdAt.toISOString(),
                  }
                : null,
            merchantReferrer: merchantLink?.merchantId
                ? {
                      merchantId: merchantLink.merchantId,
                      since: merchantLink.createdAt.toISOString(),
                  }
                : null,
        };
    },
    {
        withWalletAuthent: true,
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
                        since: t.String(),
                    }),
                    t.Null(),
                ]),
                merchantReferrer: t.Union([
                    t.Object({
                        merchantId: t.String(),
                        since: t.String(),
                    }),
                    t.Null(),
                ]),
            }),
        },
    }
);
