import type { Address, Hex } from "viem";
import type { FullInteractionTypesKey } from "../../constants/interactionTypes";
import type { ProductTypesKey } from "../../constants/productTypes";

/**
 * The currency available for the reward
 */
export type Currency = "eur" | "usd" | "gbp";

/**
 * The type for the amount of tokens
 */
export type TokenAmountType = {
    amount: number;
    eurAmount: number;
    usdAmount: number;
    gbpAmount: number;
};

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
     * The max potential reward for the referrer
     */
    maxReferrer?: TokenAmountType;
    /**
     * The max potential reward for the referee
     */
    maxReferee?: TokenAmountType;
    /**
     * List of all the potentials reward arround this product
     */
    rewards: {
        token: Address;
        campaign: Address;
        interactionTypeKey: FullInteractionTypesKey;
        referrer: TokenAmountType;
        referee: TokenAmountType;
    }[];
};
