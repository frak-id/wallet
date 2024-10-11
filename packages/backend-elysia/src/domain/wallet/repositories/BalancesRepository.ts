import {
    type AlchemyRpcSchema,
    getAlchemyTransportNoBatch,
    getTokenBalances,
} from "@frak-labs/app-essentials/blockchain";
import { LRUCache } from "lru-cache";
import {
    type Address,
    type Chain,
    type Client,
    type Transport,
    createClient,
    erc20Abi,
    formatUnits,
} from "viem";
import { multicall } from "viem/actions";

type TokenMetadata = {
    name: string;
    symbol: string;
    decimals: number;
};

export class BalancesRepository {
    // A few caches
    private readonly metadataCache = new LRUCache<Address, TokenMetadata>({
        max: 128,
    });

    // The ky client
    private readonly alchemyClient: Client<
        Transport,
        Chain,
        undefined,
        AlchemyRpcSchema
    >;

    constructor(private readonly client: Client<Transport, Chain>) {
        // Build our alchemy client
        this.alchemyClient = createClient({
            chain: client.chain,
            transport: getAlchemyTransportNoBatch({ chain: client.chain }),
            cacheTime: 60_000,
        });
    }

    /**
     * Get the user balance
     * @param address
     */
    async getUserBalance({ address }: { address: Address }) {
        const response = await getTokenBalances(this.alchemyClient, {
            address,
            type: "erc20",
        });

        // Get the effective balance, where asset are gt than 0
        const effectiveBalances = response.tokenBalances.filter(
            ({ tokenBalance }) => tokenBalance > 0n
        );

        // Then map them with the associated metadatas
        return await Promise.all(
            effectiveBalances.map(async ({ contractAddress, tokenBalance }) => {
                const metadata = await this.getTokenMetadata({
                    token: contractAddress,
                });
                return {
                    contractAddress,
                    metadata,
                    rawBalance: tokenBalance,
                    balance: Number.parseFloat(
                        formatUnits(tokenBalance, metadata.decimals)
                    ),
                };
            })
        );
    }

    /**
     * Get a token metadata
     * @param token
     */
    async getTokenMetadata({ token }: { token: Address }) {
        // Check the cache
        const cached = this.metadataCache.get(token);
        if (cached) {
            return cached;
        }

        // Fetch the metadata
        const rawMetadata = await multicall(this.client, {
            contracts: [
                {
                    abi: erc20Abi,
                    address: token,
                    functionName: "symbol",
                },
                {
                    abi: erc20Abi,
                    address: token,
                    functionName: "name",
                },
                {
                    abi: erc20Abi,
                    address: token,
                    functionName: "decimals",
                },
            ] as const,
            allowFailure: false,
        });
        const metadata: TokenMetadata = {
            symbol: rawMetadata[0],
            name: rawMetadata[1],
            decimals: rawMetadata[2],
        };

        // Cache the metadata and return them
        this.metadataCache.set(token, metadata);
        return metadata;
    }
}
