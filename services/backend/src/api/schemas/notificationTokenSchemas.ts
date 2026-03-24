import { t } from "@backend-utils";
import type { Static } from "elysia";

const WebPushSubscriptionBodySchema = t.Object({
    type: t.Literal("web-push"),
    subscription: t.Object({
        endpoint: t.String(),
        keys: t.Object({
            p256dh: t.String(),
            auth: t.String(),
        }),
        expirationTime: t.Optional(t.Number()),
    }),
    locale: t.Optional(t.String()),
});

const FcmTokenBodySchema = t.Object({
    type: t.Literal("fcm"),
    token: t.String(),
    locale: t.Optional(t.String()),
});

export const RegisterTokenBodySchema = t.Union([
    WebPushSubscriptionBodySchema,
    FcmTokenBodySchema,
]);
export type RegisterTokenBody = Static<typeof RegisterTokenBodySchema>;
