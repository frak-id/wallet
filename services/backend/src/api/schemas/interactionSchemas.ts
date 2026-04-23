import { t } from "@backend-utils";
import type { Static } from "elysia";
import { isAddress } from "viem";

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
    sharingTimestamp: t.Optional(t.Number()),
    purchaseId: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
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

/**
 * Validate arrival referrer fields beyond what TypeBox can express.
 *
 * Catches malformed payloads that would otherwise silently downgrade to a
 * `paid_ad` / `direct` touchpoint at the handler level. Rules:
 *   - No referrer fields at all → OK (organic / paid / direct).
 *   - Wallet-only → V1 legacy: wallet must be a valid {@link Address}.
 *   - Any V2 signal (clientId or wallet alongside merchantId) → must include
 *     `referrerMerchantId` plus at least one valid identifier.
 *
 * Returns a human-readable error message when invalid, or null when OK.
 */
export function validateArrivalReferrer(input: {
    referrerWallet?: string;
    referrerClientId?: string;
    referrerMerchantId?: string;
}): string | null {
    const hasWallet = Boolean(input.referrerWallet);
    const hasClientId = Boolean(input.referrerClientId);
    const hasMerchantId = Boolean(input.referrerMerchantId);

    if (!hasWallet && !hasClientId && !hasMerchantId) return null;

    // V1 legacy: wallet only, no merchantId.
    if (hasWallet && !hasClientId && !hasMerchantId) {
        return isAddress(input.referrerWallet ?? "")
            ? null
            : "referrerWallet must be a valid Ethereum address";
    }

    // V2: merchantId is mandatory once any V2-style signal is present.
    if (!hasMerchantId) {
        return "referrerMerchantId is required alongside referrerClientId or referrerWallet";
    }
    if (!hasClientId && !hasWallet) {
        return "At least one of referrerClientId or referrerWallet must be provided";
    }
    if (hasWallet && !isAddress(input.referrerWallet ?? "")) {
        return "referrerWallet must be a valid Ethereum address";
    }
    return null;
}
