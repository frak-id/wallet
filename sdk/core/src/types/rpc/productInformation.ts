import type { Address, Hex } from "viem";
import type { FullInteractionTypesKey } from "../../constants/interactionTypes";
import type { ProductTypesKey } from "../../constants/productTypes";

/**
 * Response of the `frak_getProductInformation` RPC method
 * @group RPC Schema
 */
export type GetProductInformationReturnType = {
    /**
     * Current product id
     */
    id: Hex;
    /**
     * Some metadata
     */
    onChainMetadata: {
        /**
         * Name of the product on-chain
         */
        name: string;
        /**
         * Domain of the product on-chain
         */
        domain: string;
        /**
         * The supported product types
         */
        productTypes: ProductTypesKey[];
    };
    /**
     * The max potential reward in EUR for the given product
     */
    estimatedEurReward?: string;
    /**
     * List of all the potentials reward arround this product
     */
    rewards: {
        token: Address;
        campaign: Address;
        interactionTypeKey: FullInteractionTypesKey;
        referrer: {
            amount: number;
            eurAmount: number;
            usdAmount: number;
        };
        referee: {
            amount: number;
            eurAmount: number;
            usdAmount: number;
        };
    }[];
};
