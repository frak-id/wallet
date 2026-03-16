import { t } from "@backend-utils";
import type { Static } from "elysia";

const ArrivalSubmissionSchema = t.Object({
    type: t.Literal("arrival"),
    merchantId: t.String({ format: "uuid" }),
    referrerWallet: t.Optional(t.String()),
    referrerClientId: t.Optional(t.String({ format: "uuid" })),
    referrerMerchantId: t.Optional(t.String({ format: "uuid" })),
    referralTimestamp: t.Optional(t.Number()),
    landingUrl: t.Optional(t.String()),
    utmSource: t.Optional(t.String()),
    utmMedium: t.Optional(t.String()),
    utmCampaign: t.Optional(t.String()),
    utmTerm: t.Optional(t.String()),
    utmContent: t.Optional(t.String()),
});

const SharingSubmissionSchema = t.Object({
    type: t.Literal("sharing"),
    merchantId: t.String({ format: "uuid" }),
});

const CustomSubmissionSchema = t.Object({
    type: t.Literal("custom"),
    merchantId: t.String({ format: "uuid" }),
    customType: t.String({ minLength: 1, maxLength: 100 }),
    data: t.Optional(t.Record(t.String(), t.Unknown())),
    idempotencyKey: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
});

export const InteractionSubmissionSchema = t.Union([
    ArrivalSubmissionSchema,
    SharingSubmissionSchema,
    CustomSubmissionSchema,
]);
export type InteractionSubmission = Static<typeof InteractionSubmissionSchema>;
