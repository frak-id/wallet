import { concatHex, toHex } from "viem";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import type { PreparedInteraction } from "../types";

/**
 * Webshop interactions allow you to track user activities on your webshop.
 *
 * import { Callout } from 'vocs/components'
 *
 * <Callout type="info">
 *   To properly handle webshop interactions, ensure that the "WebShop" product type is enabled in your Business dashboard.
 * </Callout>
 *
 * @description Encode webshop related user interactions
 *
 * @group Interactions Encoder
 *
 * @see {@link PreparedInteraction} The prepared interaction object that can be sent
 * @see {@link !actions.sendInteraction | `sendInteraction()`} Action used to send the prepared interaction to the Frak Wallet
 */
export const WebShopInteractionEncoder = {
    /**
     * Encode an open webshop interaction
     */
    open(): PreparedInteraction {
        const interactionData = concatHex([
            interactionTypes.webshop.open,
            "0x",
        ]);
        return {
            handlerTypeDenominator: toHex(productTypes.webshop),
            interactionData,
        };
    },
};
