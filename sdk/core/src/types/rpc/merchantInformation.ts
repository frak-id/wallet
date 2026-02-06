import type { Address } from "viem";
import type { InteractionTypeKey } from "../../constants/interactionTypes";

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
    id: string;
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
        interactionTypeKey: InteractionTypeKey;
        referrer: TokenAmountType;
        referee: TokenAmountType;
    }[];
};
