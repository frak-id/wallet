import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { CampaignBankContext } from "../../../../domain/campaign-bank";
import { BankStatusSchema } from "../../../../domain/campaign-bank/schemas";
import { businessSessionContext } from "../../middleware/session";

export const merchantBankRoutes = new Elysia({
    prefix: "/:merchantId/bank",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({
            params: { merchantId },
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

            return CampaignBankContext.services.campaignBank.getBankStatus(
                merchantId
            );
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            response: {
                200: BankStatusSchema,
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .post(
        "/sync",
        async ({
            params: { merchantId },
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

            const result =
                await CampaignBankContext.services.campaignBank.syncBankRoles(
                    merchantId
                );

            if (!result.success) {
                return status(400, result.error);
            }

            return {
                success: true,
                rolesGranted: result.rolesGranted,
                rolesRevoked: result.rolesRevoked,
            };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            response: {
                200: t.Object({
                    success: t.Boolean(),
                    rolesGranted: t.Boolean(),
                    rolesRevoked: t.Boolean(),
                }),
                400: t.String(),
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .post(
        "/deploy",
        async ({
            params: { merchantId },
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

            const result =
                await CampaignBankContext.services.campaignBank.deployAndSetupBank(
                    merchantId
                );

            if (!result.success) {
                return status(400, result.error);
            }

            return {
                success: true,
                bankAddress: result.bankAddress,
            };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            response: {
                200: t.Object({
                    success: t.Boolean(),
                    bankAddress: t.Hex(),
                }),
                400: t.String(),
                401: t.String(),
                403: t.String(),
            },
        }
    );
