import type { GetAllTokenResponseDto } from "@frak-labs/app-essentials";
import type { KyInstance } from "ky";
import { LRUCache } from "lru-cache";
import {
    type Address,
    type Chain,
    type Client,
    type Transport,
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
    private knownTokens: GetAllTokenResponseDto = [];

    constructor(
        private readonly client: Client<Transport, Chain>,
        private readonly indexerApi: KyInstance
    ) {}

    /**
     * Get the user balance
     * @param address
     */
    async getUserBalance({ address }: { address: Address }) {
        // Get the user balance on every known tokens
        const userBalances = await this.getUserBalanceViaKnownTokens({
            address,
        });

        // Get the effective balance, where asset are gt than 0
        const effectiveBalances = userBalances.filter(
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
     * Get the user balance around every known tokens
     */
    async getUserBalanceViaKnownTokens({ address }: { address: Address }) {
        // Get the known tokens
        const knownTokens = await this.getKnownTokens();

        // Fetch every balance in a single multicall
        const balanceResults = await multicall(this.client, {
            contracts: knownTokens.map(
                ({ address: contractAddress }) =>
                    ({
                        abi: erc20Abi,
                        address: contractAddress,
                        functionName: "balanceOf",
                        args: [address],
                    }) as const
            ),
        });

        // Map the results to the known tokens
        const userBalances = balanceResults.map(({ result, error }, index) => {
            if (error) {
                return {
                    contractAddress: knownTokens[index].address,
                    tokenBalance: 0n,
                };
            }

            return {
                contractAddress: knownTokens[index].address,
                tokenBalance: result,
            };
        });

        return userBalances;
    }

    /**
     * Get the known tokens from the indexer
     */
    async getKnownTokens() {
        if (this.knownTokens.length > 0) {
            return this.knownTokens;
        }

        // Fetch all the known tokens
        const response = await this.indexerApi
            .get("tokens")
            .json<GetAllTokenResponseDto>();
        this.knownTokens = response;
        return response;
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
