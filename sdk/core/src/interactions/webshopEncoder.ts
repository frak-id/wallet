import { concatHex, toHex } from "viem";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import type { PreparedInteraction } from "../types";

/**
 * Encode a create referral link interaction
 */
function open(): PreparedInteraction {
    const interactionData = concatHex([interactionTypes.webshop.open, "0x"]);
    return {
        handlerTypeDenominator: toHex(productTypes.webshop),
        interactionData,
    };
}

export const WebShopInteractionEncoder = {
    open,
};
