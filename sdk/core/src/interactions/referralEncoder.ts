import { type Address, concatHex, pad, toHex } from "viem";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import type { PreparedInteraction } from "../types";

/**
 * Encode a create referral link interaction
 */
function createLink(): PreparedInteraction {
    const interactionData = concatHex([
        interactionTypes.referral.createLink,
        "0x",
    ]);
    return {
        handlerTypeDenominator: toHex(productTypes.referral),
        interactionData,
    };
}

/**
 * Encode a referred interaction
 * @param referrer
 */
function referred({ referrer }: { referrer: Address }): PreparedInteraction {
    const interactionData = concatHex([
        interactionTypes.referral.referred,
        pad(referrer, { size: 32 }),
    ]);
    return {
        handlerTypeDenominator: toHex(productTypes.referral),
        interactionData,
    };
}

export const ReferralInteractionEncoder = {
    createLink,
    referred,
};
