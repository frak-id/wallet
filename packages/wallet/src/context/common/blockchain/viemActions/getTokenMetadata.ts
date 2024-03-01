import type {
    AlchemyRpcSchema,
    GetTokenMetadataResponse,
} from "@/context/common/blockchain/viemActions/AlchemyTypes";
import type { Account, Address, Chain, Client, Transport } from "viem";

/**
 * Get the token metadata parameters
 */
export type GetTokenMetadataParams = {
    address: Address;
};

/**
 * Get all the balances of an account
 * @param client
 * @param args
 */
export async function getTokenMetadata<
    TChain extends Chain | undefined,
    TAccount extends Account | undefined = undefined,
>(
    client: Client<Transport, TChain, TAccount, AlchemyRpcSchema>,
    args: GetTokenMetadataParams
): Promise<GetTokenMetadataResponse> {
    return await client.request({
        method: "alchemy_getTokenMetadata",
        params: [args.address],
    });
}
