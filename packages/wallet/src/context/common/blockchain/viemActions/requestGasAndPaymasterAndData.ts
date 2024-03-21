import type {
    AlchemyRpcSchema,
    RequestGasAndPaymasterAndDataRequest,
} from "@/context/common/blockchain/viemActions/AlchemyTypes";
import type {Account, Address, Chain, Client, Hex, Transport} from "viem";

/**
 * Get all the balances of an account
 * @param client
 * @param args
 */
export async function requestGasAndPaymasterAndData<
    TChain extends Chain | undefined,
    TAccount extends Account | undefined = undefined,
>(
    client: Client<Transport, TChain, TAccount, AlchemyRpcSchema>,
    args: RequestGasAndPaymasterAndDataRequest
) {
    return await client.request({
        method: "alchemy_requestGasAndPaymasterAndData",
        params: [args],
    });
}


/**
 * Get all the balances of an account
 * @param client
 */
export async function getRundlerFeePerGas<
    TChain extends Chain | undefined,
    TAccount extends Account | undefined = undefined,
>(
    client: Client<Transport, TChain, TAccount, AlchemyRpcSchema>,
) {
    return await client.request({
        method: "rundler_maxPriorityFeePerGas",
        params: [],
    });
}

