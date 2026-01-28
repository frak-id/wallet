import type { Address, Hex } from "viem";
import type { FullInteractionTypesKey } from "../../constants/interactionTypes";

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
 * Response of the `frak_getMerchantInformation` RPC method
 * @group RPC Schema
 */
export type GetMerchantInformationReturnType = {
    /**
     * Current merchant id
     */
    id: Hex;
    /**
     * Some metadata
     */
    onChainMetadata: {
        /**
         * Name of the merchant on-chain
         */
        name: string;
        /**
         * Domain of the merchant on-chain
         */
        domain: string;
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
     * List of all the potentials reward around this merchant
     */
    rewards: {
        token: Address;
        campaign: Address;
        interactionTypeKey: FullInteractionTypesKey;
        referrer: TokenAmountType;
        referee: TokenAmountType;
    }[];
};
