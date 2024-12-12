import type { Hex } from "viem";
import type { ProductTypesKey } from "../../constants/productTypes";

/**
 * Response of the `frak_getProductInformation` RPC method
 * @group RPC Schema
 */
export type GetProductInformationReturnType = Readonly<{
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
     * Current the current estimated product reward
     */
    estimatedEurReward?: string;
}>;
