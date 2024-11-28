import { walletSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import type { GetRewardResponseDto } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { sift } from "radash";
import { formatUnits, isAddressEqual, toHex } from "viem";
import { walletContext } from "../context";

export const balanceRoutes = new Elysia({ prefix: "/balance" })
    .use(walletSessionContext)
    .use(walletContext)
    .get(
        "",
        async ({
            pricingRepository,
            balancesRepository,
            walletSession,
            error,
        }) => {
            if (!walletSession) return error(401, "Unauthorized");

            // Get all the user balances
            const balances = await balancesRepository.getUserBalance({
                address: walletSession.address,
            });

            // For each balances, get the eur price
            const mappedBalances = sift(
                await Promise.all(
                    balances.map(async (tokenBalance) => {
                        // Get the eur price of the token
                        const price = await pricingRepository.getTokenPrice({
                            token: tokenBalance.contractAddress,
                        });
                        if (!price) return null;

                        // Return the well formatted balance
                        return {
                            token: tokenBalance.contractAddress,
                            name: tokenBalance.metadata.name,
                            symbol: tokenBalance.metadata.symbol,
                            decimals: tokenBalance.metadata.decimals,
                            balance: tokenBalance.balance,
                            eurBalance: tokenBalance.balance * price.eur,
                            rawBalance: toHex(tokenBalance.rawBalance),
                        };
                    })
                )
            );

            // Get the total eur balance
            const eurBalance = mappedBalances.reduce(
                (acc, { eurBalance }) => acc + eurBalance,
                0
            );

            return {
                eurBalance,
                balances: mappedBalances,
            };
        },
        {
            authenticated: "wallet",
            response: {
                401: t.String(),
                200: t.Object({
                    eurBalance: t.Number(),
                    balances: t.Array(
                        t.Object({
                            token: t.Address(),
                            name: t.String(),
                            symbol: t.String(),
                            decimals: t.Number(),
                            balance: t.Number(),
                            eurBalance: t.Number(),
                            rawBalance: t.Hex(),
                        })
                    ),
                }),
            },
        }
    )
    .get(
        "/claimable",
        async ({ indexerApi, pricingRepository, walletSession, error }) => {
            if (!walletSession) return error(401, "Unauthorized");

            // Fetch the pending rewards for this user
            const { rewards, tokens } = await indexerApi
                .get(`rewards/${walletSession.address}`)
                .json<GetRewardResponseDto>();
            if (!rewards.length) {
                return {
                    eurClaimable: 0,
                    claimables: [],
                };
            }

            // Map rewards with tokens and eur price
            const claimablesAsync = rewards.map(async (reward) => {
                const token = tokens.find((token) =>
                    isAddressEqual(token.address, reward.token)
                );
                if (!token) return null;

                // Get the eur price of the token
                const price = await pricingRepository.getTokenPrice({
                    token: reward.token,
                });
                if (!price) return null;

                const rawBalance = BigInt(reward.amount);
                const balance = Number.parseFloat(
                    formatUnits(rawBalance, token.decimals)
                );

                return {
                    contract: reward.address,
                    token: reward.token,
                    name: token.name,
                    symbol: token.symbol,
                    decimals: token.decimals,
                    balance: balance,
                    eurBalance: balance * price.eur,
                    rawBalance: toHex(rawBalance),
                };
            });
            const claimables = sift(await Promise.all(claimablesAsync));

            // Get the total eur claimable
            const eurClaimable = claimables.reduce(
                (acc, { eurBalance }) => acc + eurBalance,
                0
            );

            return {
                eurClaimable,
                claimables,
            };
        },
        {
            authenticated: "wallet",
            response: {
                401: t.String(),
                200: t.Object({
                    eurClaimable: t.Number(),
                    claimables: t.Array(
                        t.Object({
                            contract: t.Address(),
                            token: t.Address(),
                            name: t.String(),
                            symbol: t.String(),
                            decimals: t.Number(),
                            balance: t.Number(),
                            eurBalance: t.Number(),
                            rawBalance: t.Hex(),
                        })
                    ),
                }),
            },
        }
    );
