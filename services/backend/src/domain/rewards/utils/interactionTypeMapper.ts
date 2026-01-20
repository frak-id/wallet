import { t } from "@backend-utils";
import type { Static } from "elysia";
import type { InteractionType } from "../schemas";

export const TriggerTypeSchema = t.Union([
    t.Literal("referral"),
    t.Literal("purchase"),
    t.Literal("wallet_connect"),
    t.Literal("identity_merge"),
]);

/**
 * API trigger type for reward interactions.
 * Maps database interaction types to trigger types.
 */
export type TriggerType = Static<typeof TriggerTypeSchema>;

/**
 * Maps database interaction types to API trigger types.
 *
 * Mapping:
 * - referral_arrival → "referral"
 * - purchase → "purchase"
 * - wallet_connect → "wallet_connect"
 * - identity_merge → "identity_merge"
 * - null → null
 *
 * @param dbType - The interaction type from the database, or null
 * @returns The corresponding trigger type, or null
 */
export function mapInteractionType(
    dbType: InteractionType | null
): TriggerType | null {
    if (dbType === null) {
        return null;
    }

    switch (dbType) {
        case "referral_arrival":
            return "referral";
        case "purchase":
            return "purchase";
        case "wallet_connect":
            return "wallet_connect";
        case "identity_merge":
            return "identity_merge";
        default: {
            const _exhaustive: never = dbType;
            return _exhaustive;
        }
    }
}
