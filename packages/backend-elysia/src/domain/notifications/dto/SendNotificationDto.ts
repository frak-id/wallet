import { t } from "@backend-utils";

export const SendNotificationTargetsDto = t.Union([
    t.Object({
        wallets: t.Array(t.Address()),
    }),
    t.Object({
        filter: t.Partial(
            t.Object({
                productIds: t.Array(t.Hex()),
                interactions: t.Partial(
                    t.Object({
                        min: t.Number(),
                        max: t.Number(),
                    })
                ),
                rewards: t.Partial(
                    t.Object({
                        min: t.Hex(),
                        max: t.Hex(),
                    })
                ),
                firstInteractionTimestamp: t.Partial(
                    t.Object({
                        min: t.Number(),
                        max: t.Number(),
                    })
                ),
            })
        ),
    }),
]);

export const SendNotificationPayloadDto = t.Object({
    title: t.String(),
    body: t.String(),
    badge: t.Optional(t.String()),
    icon: t.Optional(t.String()),
    lang: t.Optional(t.String()),
    requireInteraction: t.Optional(t.Boolean()),
    silent: t.Optional(t.Boolean()),
    tag: t.Optional(t.String()),
    data: t.Optional(
        t.Object({
            url: t.Optional(t.String()),
        })
    ),
    actions: t.Optional(
        t.Array(
            t.Object({
                action: t.String(),
                title: t.String(),
                icon: t.Optional(t.String()),
            })
        )
    ),
});
