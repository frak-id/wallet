import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MerchantContext } from "../../../domain/merchant";
import {
    MerchantDetailResponseSchema,
    MerchantIdParamSchema,
    MyMerchantsResponseSchema,
    SuccessResponseSchema,
} from "../../schemas";
import { businessSessionContext } from "../middleware/session";
import { merchantAdminsRoutes } from "./admins";
import { merchantBankRoutes } from "./bank";
import { merchantCampaignStatsRoutes } from "./campaignStats";
import { merchantCampaignsRoutes } from "./campaigns";
import { merchantExplorerRoutes } from "./explorer";
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
        async ({ params: { merchantId }, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const merchant =
                await MerchantContext.repositories.merchant.findById(
                    merchantId
                );
            if (!merchant) {
                return status(404, "Merchant not found");
            }

            const access =
                await MerchantContext.services.authorization.checkAccess(
                    merchantId,
                    businessSession.wallet
                );
            if (!access.hasAccess) {
                return status(403, "Access denied");
            }

            return {
                id: merchant.id,
                domain: merchant.domain,
                name: merchant.name,
                ownerWallet: merchant.ownerWallet,
                bankAddress: merchant.bankAddress,
                defaultRewardToken: merchant.defaultRewardToken,
                explorerConfig: merchant.explorerConfig ?? null,
                explorerEnabledAt:
                    merchant.explorerEnabledAt?.toISOString() ?? null,
                verifiedAt: merchant.verifiedAt?.toISOString() ?? null,
                createdAt: merchant.createdAt?.toISOString() ?? null,
                role: access.role,
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

            const owned =
                await MerchantContext.repositories.merchant.findByOwnerWallet(
                    businessSession.wallet
                );

            const adminOf =
                await MerchantContext.repositories.merchantAdmin.findByWallet(
                    businessSession.wallet
                );

            const adminMerchantIds = adminOf.map((a) => a.merchantId);
            const adminMerchants = await Promise.all(
                adminMerchantIds.map((id) =>
                    MerchantContext.repositories.merchant.findById(id)
                )
            );

            return {
                owned: owned.map((m) => ({
                    id: m.id,
                    domain: m.domain,
                    name: m.name,
                })),
                adminOf: adminMerchants
                    .filter((m) => m !== null)
                    .map((m) => ({
                        id: m.id,
                        domain: m.domain,
                        name: m.name,
                    })),
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
        async ({
            params: { merchantId },
            body,
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

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

            return { success: true };
        },
        {
            params: MerchantIdParamSchema,
            body: t.Object({
                name: t.Optional(t.String()),
                defaultRewardToken: t.Optional(t.Hex()),
            }),
            response: {
                200: SuccessResponseSchema,
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
    .use(merchantCampaignStatsRoutes)
    .use(merchantMembersRoutes)
    .use(merchantWebhooksRoutes);
