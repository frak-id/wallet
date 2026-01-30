import {
    indexerApi,
    type TokenMetadata,
    tokenMetadataRepository,
    viemClient,
} from "@backend-infrastructure";
import { type Address, erc20Abi, formatUnits } from "viem";
import { multicall } from "viem/actions";
import type { GetAllTokenResponseDto } from "../types/indexerTypes";

export class BalancesRepository {
    private knownTokens: GetAllTokenResponseDto = [];

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
        const balanceResults = await multicall(viemClient, {
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
        const response = await indexerApi
            .get("tokens")
            .json<GetAllTokenResponseDto>();
        this.knownTokens = response;
        return response;
    }

    /**
     * Get a token metadata
     * @param token
     */
    async getTokenMetadata({
        token,
    }: {
        token: Address;
    }): Promise<TokenMetadata> {
        return tokenMetadataRepository.getMetadata({ token });
    }
}
