import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MerchantContext, SdkConfigSchema } from "../../../domain/merchant";
import { MerchantIdParamSchema, SuccessResponseSchema } from "../../schemas";
import { businessSessionContext } from "../middleware/session";

export const merchantSdkConfigRoutes = new Elysia({
    prefix: "/:merchantId/sdk-config",
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

            const merchant =
                await MerchantContext.repositories.merchant.findById(
                    merchantId
                );
            if (!merchant) {
                return status(404, "Merchant not found");
            }

            return {
                sdkConfig: merchant.sdkConfig ?? {},
            };
        },
        {
            params: MerchantIdParamSchema,
            response: {
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .put(
        "",
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

            const merchant =
                await MerchantContext.repositories.merchant.findById(
                    merchantId
                );
            if (!merchant) {
                return status(404, "Merchant not found");
            }

            const merged = {
                ...(merchant.sdkConfig ?? {}),
                ...body,
                translations:
                    body.translations ??
                    merchant.sdkConfig?.translations ??
                    undefined,
                placements:
                    body.placements ??
                    merchant.sdkConfig?.placements ??
                    undefined,
            };

            const cleanedConfig = Object.fromEntries(
                Object.entries(merged).filter(([_, v]) => v !== null)
            );

            await MerchantContext.repositories.merchant.updateSdkConfig(
                merchantId,
                cleanedConfig
            );

            return { success: true };
        },
        {
            params: MerchantIdParamSchema,
            body: SdkConfigSchema,
            response: {
                200: SuccessResponseSchema,
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
