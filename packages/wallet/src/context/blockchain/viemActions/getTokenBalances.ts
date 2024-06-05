import type {
    AlchemyRpcSchema,
    GetTokenBalancesRawResponse,
} from "@/context/blockchain/viemActions/AlchemyTypes";
import type { Account, Address, Chain, Client, Transport } from "viem";

/**
 * Get all the balances of an account parameters
 */
export type GetTokenBalancesParameters = {
    address: Address;
    type: "erc20";
};

/**
 * Get all the balances of an account, formatted output of the action
 */
export type GetTokenBalancesResponse = {
    address: Address;
    tokenBalances: {
        contractAddress: Address;
        tokenBalance: bigint;
    }[];
};

/**
 * Get all the balances of an account
 * @param client
 * @param args
 */
export async function getTokenBalances<
    TChain extends Chain | undefined,
    TAccount extends Account | undefined = undefined,
>(
    client: Client<Transport, TChain, TAccount, AlchemyRpcSchema>,
    args: GetTokenBalancesParameters
): Promise<GetTokenBalancesResponse> {
    const data: GetTokenBalancesRawResponse = await client.request({
        method: "alchemy_getTokenBalances",
        params: [args.address, args.type],
    });

    // Format each balances to a bigint
    const tokenBalances = data.tokenBalances.map((balance) => ({
        ...balance,
        tokenBalance: BigInt(balance.tokenBalance),
    }));

    // Return the formatted response
    return {
        address: data.address,
        tokenBalances,
    };
}
