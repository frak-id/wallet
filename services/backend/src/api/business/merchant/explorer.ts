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
            const updated =
                await MerchantContext.repositories.merchant.updateExplorer(
                    merchantId,
                    {
                        config: body.config,
                        enabled: body.enabled,
                    }
                );

            OrchestrationContext.orchestrators.explorer.invalidateCache();
            // The resolved SDK config carries the Explorer image as the ambassador photo default.
            if (updated) {
                MerchantContext.services.resolve.invalidateForMerchant(updated);
            }

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
