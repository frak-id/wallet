import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AffiliateContext } from "../../../domain/affiliate";
import { BusinessAuthContext } from "../../../domain/business-auth";
import { MerchantContext } from "../../../domain/merchant";
import {
    MerchantDetailResponseSchema,
    MerchantIdParamSchema,
    MyMerchantsResponseSchema,
} from "../../schemas";
import {
    businessSessionContext,
    isPlatformAdminAuth,
} from "../middleware/session";
import { merchantAdminsRoutes } from "./admins";
import { merchantAffiliateReportingRoutes } from "./affiliateReporting";
import { merchantAllowedDomainsRoutes } from "./allowedDomains";
import { merchantBankRoutes } from "./bank";
import { merchantBillingRoutes } from "./billingRoutes";
import { merchantCampaignDetailsRoutes } from "./campaignDetails";
import { merchantCampaignOverviewRoutes } from "./campaignOverview";
import { merchantCampaignsRoutes } from "./campaigns";
import { merchantExplorerRoutes } from "./explorer";
import { merchantMediaRoutes } from "./media";
import { merchantMembersRoutes } from "./members";
import { merchantRegistrationRoutes } from "./registration";
import { merchantSdkConfigRoutes } from "./sdkConfig";
import { merchantTransferRoutes } from "./transfer";
import { merchantWebhooksRoutes } from "./webhooks";

export const merchantRoutes = new Elysia({ prefix: "/merchant" })
    .use(merchantRegistrationRoutes)
    .use(businessSessionContext)
    .get(
        "/:merchantId",
        async ({
            params: { merchantId },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const merchant =
                await MerchantContext.repositories.merchant.findById(
                    merchantId
                );
            if (!merchant) {
                return status(404, "Merchant not found");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            // Determine role: check identity-based access for business
            // sessions, default to "admin" for Shopify sessions (shop owner)
            let role: "owner" | "admin" | "platform_admin" | "none" = "admin";
            if (businessSession) {
                const access =
                    await MerchantContext.services.authorization.checkAccess(
                        merchantId,
                        businessSession
                    );
                role = access.role;
                // Platform admins have no real merchant relationship so
                // checkAccess returns "none". Derive the role here, keeping
                // the auth-domain concern out of MerchantAuthorizationService.
                // Covers both grants: the wallet allow-list AND a verified
                // @frak-labs.com account email.
                if (
                    role === "none" &&
                    (await isPlatformAdminAuth(businessSession))
                ) {
                    role = "platform_admin";
                }
            }

            const brand =
                await AffiliateContext.repositories.affiliateBrand.findByMerchantId(
                    merchantId
                );

            return {
                id: merchant.id,
                domain: merchant.domain,
                allowedDomains: merchant.allowedDomains ?? [],
                name: merchant.name,
                ownerWallet: merchant.ownerWallet,
                bankAddress: merchant.bankAddress,
                defaultRewardToken: merchant.defaultRewardToken,
                explorerConfig: merchant.explorerConfig ?? null,
                explorerEnabledAt:
                    merchant.explorerEnabledAt?.toISOString() ?? null,
                verifiedAt: merchant.verifiedAt?.toISOString() ?? null,
                createdAt: merchant.createdAt?.toISOString() ?? null,
                role,
                affiliate: brand
                    ? {
                          provider: brand.provider,
                          externalId: brand.externalId,
                          trackingLink: brand.trackingLink,
                      }
                    : null,
            };
        },
        {
            params: MerchantIdParamSchema,
            response: {
                200: MerchantDetailResponseSchema,
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .get(
        "/my",
        async ({ businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            // Platform admin via EITHER the wallet allow-list OR a verified
            // @frak-labs.com account email — the single canonical check.
            const isPlatAdmin = await isPlatformAdminAuth(businessSession);

            // Shopify SSO auto-link (§4.7): the shop domain proven by the
            // account's Shopify identity, looked up here (BFF layer) and
            // passed as plain data — the merchant domain must never import
            // business-auth (flow rules). An account holds at most one
            // Shopify identity (§4.3).
            const shopAccount = businessSession.accountId
                ? await BusinessAuthContext.repositories.account.findById(
                      businessSession.accountId
                  )
                : null;
            const shopDomain = shopAccount?.shopifyShopDomain ?? null;

            // Enumerate ownership on both identity axes (wallet + account)
            // so walletless users see their merchants too.
            const [ownedByWallet, ownedByAccount, adminOf] = await Promise.all([
                businessSession.wallet
                    ? MerchantContext.repositories.merchant.findByOwnerWallet(
                          businessSession.wallet
                      )
                    : Promise.resolve([]),
                businessSession.accountId
                    ? MerchantContext.repositories.merchant.findByOwnerAccount(
                          businessSession.accountId
                      )
                    : Promise.resolve([]),
                MerchantContext.repositories.merchantAdmin.findByIdentity(
                    businessSession
                ),
            ]);

            // Dedupe wallet/account overlap (both axes set on one merchant).
            const owned = [
                ...new Map(
                    [...ownedByWallet, ...ownedByAccount].map((m) => [m.id, m])
                ).values(),
            ];

            const adminMerchantIds = adminOf.map((a) => a.merchantId);
            const adminMerchants = await Promise.all(
                adminMerchantIds.map((id) =>
                    MerchantContext.repositories.merchant.findById(id)
                )
            );

            // Platform admins get the full list (for `allMerchants` + the
            // affiliate batch); everyone else only needs their own rows.
            const allMerchantsRaw = isPlatAdmin
                ? await MerchantContext.repositories.merchant.findAll()
                : [];

            // Shop-domain-matched merchants (excluding ones already owned)
            // surfaced as read/write "admin" access, same role granted by
            // `MerchantAuthorizationService.checkAccess`. Shared lookup with
            // `getAccessibleMerchantIds` (§2.13). Deduped against `adminOf`
            // below.
            const ownedIds = new Set(owned.map((m) => m.id));
            const shopMatched = shopDomain
                ? (
                      await MerchantContext.services.authorization.getShopDomainMatchedMerchants(
                          shopDomain
                      )
                  ).filter((m) => !ownedIds.has(m.id))
                : [];

            const nonNullAdmins = [
                ...new Map(
                    [
                        ...adminMerchants.filter((m) => m !== null),
                        ...shopMatched,
                    ].map((m) => [m.id, m])
                ).values(),
            ];

            // One batched lookup so each card can flag affiliate (TakeAds) brands.
            const affiliateIds =
                await AffiliateContext.repositories.affiliateBrand.listMerchantIdsWithBrand(
                    [
                        ...owned.map((m) => m.id),
                        ...nonNullAdmins.map((m) => m.id),
                        ...allMerchantsRaw.map((m) => m.id),
                    ]
                );

            const toSummary = (m: {
                id: string;
                domain: string;
                name: string;
            }) => ({
                id: m.id,
                domain: m.domain,
                name: m.name,
                isAffiliate: affiliateIds.has(m.id),
            });

            return {
                owned: owned.map(toSummary),
                adminOf: nonNullAdmins.map(toSummary),
                isPlatformAdmin: isPlatAdmin,
                allMerchants: isPlatAdmin
                    ? allMerchantsRaw.map(toSummary)
                    : undefined,
            };
        },
        {
            response: {
                200: MyMerchantsResponseSchema,
                401: t.String(),
            },
        }
    )
    .put(
        "/:merchantId",
        async ({ params: { merchantId }, body }) => {
            const updated = await MerchantContext.repositories.merchant.update(
                merchantId,
                {
                    name: body.name,
                    defaultRewardToken: body.defaultRewardToken,
                }
            );

            if (!updated) {
                return status(404, "Merchant not found");
            }

            MerchantContext.services.resolve.invalidateForMerchant(updated);

            return status(204);
        },
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            body: t.Object({
                name: t.Optional(t.String()),
                defaultRewardToken: t.Optional(t.Hex()),
            }),
            response: {
                204: t.Void(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .use(merchantAdminsRoutes)
    .use(merchantBankRoutes)
    .use(merchantExplorerRoutes)
    .use(merchantSdkConfigRoutes)
    .use(merchantTransferRoutes)
    .use(merchantCampaignsRoutes)
    .use(merchantCampaignDetailsRoutes)
    .use(merchantCampaignOverviewRoutes)
    .use(merchantMembersRoutes)
    .use(merchantWebhooksRoutes)
    .use(merchantMediaRoutes)
    .use(merchantAllowedDomainsRoutes)
    .use(merchantAffiliateReportingRoutes)
    .use(merchantBillingRoutes);
