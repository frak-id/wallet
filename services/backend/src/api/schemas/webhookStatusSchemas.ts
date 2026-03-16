import { t } from "@backend-utils";
import type { Static } from "elysia";
import { WebhookPlatformSchema } from "../../domain/purchases/schemas";

export const WebhookStatusResponseSchema = t.Union([
    t.Object({
        setup: t.Literal(false),
    }),
    t.Object({
        setup: t.Literal(true),
        platform: WebhookPlatformSchema,
        webhookSigninKey: t.String(),
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
export type WebhookStatusResponse = Static<typeof WebhookStatusResponseSchema>;
