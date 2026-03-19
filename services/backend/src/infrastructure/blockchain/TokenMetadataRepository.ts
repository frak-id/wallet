import { viemClient } from "@backend-infrastructure";
import { LRUCache } from "lru-cache";
import { type Address, erc20Abi } from "viem";
import { multicall } from "viem/actions";

export type TokenMetadata = {
    name: string;
    symbol: string;
    decimals: number;
};

export class TokenMetadataRepository {
    private readonly cache = new LRUCache<Address, TokenMetadata>({
        max: 128,
    });

    /**
     * Get the decimals for a token
     */
    async getDecimals({ token }: { token: Address }): Promise<number> {
        const metadata = await this.getMetadata({ token });
        return metadata.decimals;
    }

    /**
     * Get the full metadata for a token (name, symbol, decimals)
     */
    async getMetadata({ token }: { token: Address }): Promise<TokenMetadata> {
        const cached = this.cache.get(token);
        if (cached) {
            return cached;
        }

        const rawMetadata = await multicall(viemClient, {
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

        this.cache.set(token, metadata);
        return metadata;
    }

    async getMetadataBatch(
        tokens: Address[]
    ): Promise<Map<Address, TokenMetadata>> {
        const result = new Map<Address, TokenMetadata>();
        const uncached: Address[] = [];

        for (const token of tokens) {
            const cached = this.cache.get(token);
            if (cached) {
                result.set(token, cached);
            } else {
                uncached.push(token);
            }
        }

        if (uncached.length === 0) return result;

        const contracts = uncached.flatMap(
            (token) =>
                [
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
                ] as const
        );

        const rawResults = await multicall(viemClient, {
            contracts,
            allowFailure: true,
        });

        for (let i = 0; i < uncached.length; i++) {
            const token = uncached[i];
            if (!token) continue;

            const symbolResult = rawResults[i * 3];
            const nameResult = rawResults[i * 3 + 1];
            const decimalsResult = rawResults[i * 3 + 2];

            if (
                symbolResult?.status === "success" &&
                nameResult?.status === "success" &&
                decimalsResult?.status === "success"
            ) {
                const metadata: TokenMetadata = {
                    symbol: symbolResult.result as string,
                    name: nameResult.result as string,
                    decimals: decimalsResult.result as number,
                };
                this.cache.set(token, metadata);
                result.set(token, metadata);
            } else {
                const fallback: TokenMetadata = {
                    symbol: "UNKNOWN",
                    name: "Unknown Token",
                    decimals: 18,
                };
                result.set(token, fallback);
            }
        }

        return result;
    }
}

export const tokenMetadataRepository = new TokenMetadataRepository();
