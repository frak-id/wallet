import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { CampaignBankContext } from "../../../domain/campaign-bank";
import { BankStatusSchema } from "../../../domain/campaign-bank/schemas";
import { MerchantIdParamSchema } from "../../schemas";
import { businessSessionContext } from "../middleware/session";

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

            const result =
                await CampaignBankContext.services.campaignBank.getBankStatus(
                    merchantId
                );

            return {
                deployed: result.deployed,
                bankAddress: result.bankAddress,
                ownerHasManagerRole: result.ownerHasManagerRole,
            };
        },
        {
            params: MerchantIdParamSchema,
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

            const { rolesGranted, rolesRevoked } =
                await CampaignBankContext.services.campaignBank.syncBankRoles(
                    merchantId
                );

            return {
                rolesGranted,
                rolesRevoked,
            };
        },
        {
            params: MerchantIdParamSchema,
            response: {
                200: t.Object({
                    rolesGranted: t.Boolean(),
                    rolesRevoked: t.Boolean(),
                }),
                400: t.ErrorResponse,
                404: t.ErrorResponse,
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

            const { bankAddress } =
                await CampaignBankContext.services.campaignBank.deployAndSetupBank(
                    merchantId
                );

            return {
                bankAddress,
            };
        },
        {
            params: MerchantIdParamSchema,
            response: {
                200: t.Object({
                    bankAddress: t.Hex(),
                }),
                400: t.ErrorResponse,
                404: t.ErrorResponse,
                401: t.String(),
                403: t.String(),
            },
        }
    );
