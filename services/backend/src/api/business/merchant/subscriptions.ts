import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { PurchasesContext } from "../../../domain/purchases/context";
import { SubscriptionProviderSchema } from "../../../domain/purchases/schemas";
import {
    MerchantIdParamSchema,
    SubscriptionStatusResponseSchema,
} from "../../schemas";
import { businessSessionContext } from "../middleware/session";

export const merchantSubscriptionsRoutes = new Elysia({
    prefix: "/:merchantId/subscriptions",
})
    .use(businessSessionContext)
    .get(
        "",
        ({ params: { merchantId } }) =>
            PurchasesContext.services.subscriptionConnection.getStatus(
                merchantId
            ),
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            response: {
                200: SubscriptionStatusResponseSchema,
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .put(
        "",
        async ({ params: { merchantId }, body }) => {
            const outcome =
                await PurchasesContext.services.subscriptionConnection.connect({
                    merchantId,
                    provider: body.provider,
                    token: body.token.trim(),
                });
            switch (outcome) {
                case "connected":
                    return status(204);
                case "no_webhook":
                    return status(
                        409,
                        "Set up the order webhook before connecting a subscription provider"
                    );
                case "unauthorized":
                    return status(400, "The provider rejected this token");
                case "unavailable":
                    return status(502, "The provider could not be reached");
            }
        },
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            body: t.Object({
                provider: SubscriptionProviderSchema,
                token: t.String({ minLength: 8, maxLength: 512 }),
            }),
            response: {
                204: t.Void(),
                400: t.String(),
                401: t.String(),
                403: t.String(),
                409: t.String(),
                502: t.String(),
            },
        }
    )
    .delete(
        "",
        async ({ params: { merchantId } }) => {
            await PurchasesContext.services.subscriptionConnection.disconnect(
                merchantId
            );
            return status(204);
        },
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            response: {
                204: t.Void(),
                401: t.String(),
                403: t.String(),
            },
        }
    );
