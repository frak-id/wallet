import { concatHex, type Hex, pad, toHex } from "viem";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import type { PreparedInteraction } from "../types";

/**
 * Retail interactions allow you to track user activities on your retails products.
 *
 * :::info
 *   To properly handle retail interactions, ensure that the "Retail" product type is enabled in your Business dashboard.
 * :::
 *
 * @description Encode retail related user interactions
 *
 * @group Interactions Encoder
 *
 * @see {@link PreparedInteraction} The prepared interaction object that can be sent
 * @see {@link !actions.sendInteraction | `sendInteraction()`} Action used to send the prepared interaction to the Frak Wallet
 */
export const RetailInteractionEncoder = {
    /**
     * Encode a customer meeting retail interaction
     * @param args
     * @param args.agencyId - The id of the agency that the customer is meeting with
     *
     */
    customerMeeting({ agencyId }: { agencyId: Hex }): PreparedInteraction {
        const interactionData = concatHex([
            interactionTypes.retail.customerMeeting,
            pad(agencyId, { size: 32 }),
        ]);
        return {
            handlerTypeDenominator: toHex(productTypes.retail),
            interactionData,
        };
    },
};
