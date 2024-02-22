import type { Address, Hex } from "viem";

/**
 * Custom alchemy rpc methods
 */
export type AlchemyRpcSchema = [
    {
        Method: "alchemy_getTokenBalances";
        Parameters: [address: Address, type: "erc20"];
        ReturnType: GetTokenBalancesRawResponse;
    },
    {
        Method: "alchemy_getTokenMetadata";
        Parameters: [address: Address];
        ReturnType: GetTokenBalancesRawResponse;
    },
];

/**
 * Raw response of the get token balances method
 */
export type GetTokenBalancesRawResponse = {
    address: Address;
    tokenBalances: {
        contractAddress: Address;
        tokenBalance: Hex;
    }[];
};

/**
 * Raw response of the get token balances method
 */
export type GetTokenMetadataResponse = {
    address: Address;
    tokenBalances: {
        name: string;
        symbol: string;
        decimals: number;
        logo: string | null;
    }[];
};
