import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    ExplorerConfigSchema,
    MerchantContext,
} from "../../../domain/merchant";
import { OrchestrationContext } from "../../../orchestration";
import { MerchantIdParamSchema } from "../../schemas";
import { businessSessionContext } from "../middleware/session";

export const merchantExplorerRoutes = new Elysia({
    prefix: "/:merchantId/explorer",
})
    .use(businessSessionContext)
    .put(
        "",
        async ({ params: { merchantId }, body }) => {
            await MerchantContext.repositories.merchant.updateExplorer(
                merchantId,
                {
                    config: body.config,
                    enabled: body.enabled,
                }
            );

            OrchestrationContext.orchestrators.explorer.invalidateCache();

            return status(204);
        },
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            body: t.Object({
                enabled: t.Optional(t.Boolean()),
                config: t.Optional(ExplorerConfigSchema),
            }),
            response: {
                204: t.Void(),
                401: t.String(),
                403: t.String(),
            },
        }
    );
