import { type Address, concatHex, pad } from "viem";
import type { PreparedInteraction } from "../types";

/**
 * Denominator for the referral content type
 */
const ReferralTypeSelector = "0x02";

/**
 * All the referral interactions actions
 */
export const ReferralActionsSelector = {
    CreateLink: "0xb2c0f17c",
    Referred: "0x010cc3b9",
} as const;

/**
 * Encode a create referral link interaction
 */
function createLink(): PreparedInteraction {
    const interactionData = concatHex([
        ReferralActionsSelector.CreateLink,
        "0x",
    ]);
    return {
        handlerTypeDenominator: ReferralTypeSelector,
        interactionData,
    };
}

/**
 * Encode a referred interaction
 * @param referrer
 */
function referred({ referrer }: { referrer: Address }): PreparedInteraction {
    const interactionData = concatHex([
        ReferralActionsSelector.Referred,
        pad(referrer, { size: 32 }),
    ]);
    return {
        handlerTypeDenominator: ReferralTypeSelector,
        interactionData,
    };
}

export const ReferralInteractionEncoder = {
    createLink,
    referred,
};
