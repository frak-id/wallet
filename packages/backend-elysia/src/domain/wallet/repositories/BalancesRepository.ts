import { log } from "@backend-common";
import type { GetAllTokenResponseDto } from "@frak-labs/app-essentials";
import type { KyInstance } from "ky";
import { LRUCache } from "lru-cache";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    erc20Abi,
    formatUnits,
    keccak256,
} from "viem";
import { multicall, readContract } from "viem/actions";

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
    private readonly userBalanceCache = new LRUCache<Hex, bigint>({
        max: 8192,
        // Keep in cache for 3 minutes
        ttl: 180_000,
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

        // Fetch every balance in an async manner
        const userBalanceFetchAsync = knownTokens.map(
            async ({ address: contractAddress }) => {
                // Check in the cache first
                const key = keccak256(`${address}-${contractAddress}`);
                const cached = this.userBalanceCache.get(key);
                if (cached) {
                    return {
                        contractAddress,
                        tokenBalance: cached,
                    };
                }

                // Otherwise fetch it from the client
                try {
                    const balance = await readContract(this.client, {
                        address: contractAddress,
                        abi: erc20Abi,
                        functionName: "balanceOf",
                        args: [address],
                    });
                    this.userBalanceCache.set(key, balance);
                    return {
                        contractAddress,
                        tokenBalance: balance,
                    };
                } catch (e) {
                    log.warn(
                        { error: e },
                        "Error when fetching the balance directly"
                    );
                }
                return {
                    contractAddress,
                    tokenBalance: 0n,
                };
            }
        );

        return await Promise.all(userBalanceFetchAsync);
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
