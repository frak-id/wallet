import { t } from "@backend-utils";
import {
    SubscriptionProviderSchema,
    WebhookPlatformSchema,
} from "../../domain/purchases/schemas";

export const WebhookStatusResponseSchema = t.Union([
    t.Object({
        setup: t.Literal(false),
    }),
    t.Object({
        setup: t.Literal(true),
        platform: WebhookPlatformSchema,
        webhookSigninKey: t.Optional(t.String()),
        stats: t.Partial(
            t.Object({
                firstPurchase: t.Date(),
                lastPurchase: t.Date(),
                lastUpdate: t.Date(),
                totalPurchaseHandled: t.Number(),
            })
        ),
    }),
]);

export const SubscriptionStatusResponseSchema = t.Object({
    provider: t.Union([SubscriptionProviderSchema, t.Null()]),
    lastError: t.Union([
        t.Object({ code: t.Literal("unauthorized"), at: t.String() }),
        t.Null(),
    ]),
});
