import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    ExplorerConfigSchema,
    MerchantContext,
} from "../../../domain/merchant";
import { OrchestrationContext } from "../../../orchestration";
import { MerchantIdParamSchema, SuccessResponseSchema } from "../../schemas";
import { businessSessionContext } from "../middleware/session";

export const merchantExplorerRoutes = new Elysia({
    prefix: "/:merchantId/explorer",
})
    .use(businessSessionContext)
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

            await MerchantContext.repositories.merchant.updateExplorer(
                merchantId,
                {
                    config: body.config,
                    enabled: body.enabled,
                }
            );

            OrchestrationContext.orchestrators.explorer.invalidateCache();

            return { success: true };
        },
        {
            params: MerchantIdParamSchema,
            body: t.Object({
                enabled: t.Optional(t.Boolean()),
                config: t.Optional(ExplorerConfigSchema),
            }),
            response: {
                200: SuccessResponseSchema,
                401: t.String(),
                403: t.String(),
            },
        }
    );
