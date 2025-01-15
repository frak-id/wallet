import { type Address, concatHex, pad, toHex } from "viem";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import type { PreparedInteraction } from "../types";

/**
 * Referral interactions allow you to track user sharing activities.
 * These interactions are essential for platforms looking to grow their user base through user-to-user referrals and reward systems.
 *
 * :::info
 *   To properly handle referral interactions, ensure that the "Referral" product type is enabled in your Business dashboard.
 * :::
 *
 * @description Encode referral related user interactions
 *
 * @group Interactions Encoder
 *
 * @see {@link PreparedInteraction} The prepared interaction object that can be sent
 * @see {@link !actions.sendInteraction | `sendInteraction()`} Action used to send the prepared interaction to the Frak Wallet
 */
export const ReferralInteractionEncoder = {
    /**
     * Records the event of a user creating a referral link. Note that this interaction doesn't actually create the link itself; it only sends an event to track that a link was created.
     */
    createLink(): PreparedInteraction {
        return {
            handlerTypeDenominator: toHex(productTypes.referral),
            interactionData: interactionTypes.referral.createLink,
        };
    },

    /**
     * Encode a referred interaction
     * @param args
     * @param args.referrer - The Ethereum address of the user who made the referral
     */
    referred({ referrer }: { referrer: Address }): PreparedInteraction {
        const interactionData = concatHex([
            interactionTypes.referral.referred,
            pad(referrer, { size: 32 }),
        ]);
        return {
            handlerTypeDenominator: toHex(productTypes.referral),
            interactionData,
        };
    },
};
