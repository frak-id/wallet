import { pricingRepository, sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { toHex } from "viem";
import { WalletContext } from "../../../../domain/wallet";

export const balanceRoutes = new Elysia({ prefix: "/balance" })
    .use(sessionContext)
    // Get current user balance
    .get(
        "",
        async ({ walletSession }) => {
            // Get all the user balances
            const balances =
                await WalletContext.repositories.balances.getUserBalance({
                    address: walletSession.address,
                });

            // For each balances, get the eur price
            const mappedBalances = (
                await Promise.all(
                    balances.map(async (tokenBalance) => {
                        // Get the eur price of the token
                        const price = await pricingRepository.getTokenPrice({
                            token: tokenBalance.contractAddress,
                        });

                        // Return the well formatted balance
                        return {
                            token: tokenBalance.contractAddress,
                            name: tokenBalance.metadata.name,
                            symbol: tokenBalance.metadata.symbol,
                            decimals: tokenBalance.metadata.decimals,
                            rawBalance: toHex(tokenBalance.rawBalance),
                            // Formatted amount
                            amount: tokenBalance.balance,
                            eurAmount: price
                                ? tokenBalance.balance * price.eur
                                : 0,
                            usdAmount: price
                                ? tokenBalance.balance * price.usd
                                : 0,
                            gbpAmount: price
                                ? tokenBalance.balance * price.gbp
                                : 0,
                        };
                    })
                )
            ).filter((v) => v !== null && v !== undefined);

            // Get the total balance
            const totalBalance = mappedBalances.reduce(
                (acc, { amount, eurAmount, usdAmount, gbpAmount }) => ({
                    amount: acc.amount + amount,
                    eurAmount: acc.eurAmount + eurAmount,
                    usdAmount: acc.usdAmount + usdAmount,
                    gbpAmount: acc.gbpAmount + gbpAmount,
                }),
                { amount: 0, eurAmount: 0, usdAmount: 0, gbpAmount: 0 }
            );

            return {
                total: totalBalance,
                balances: mappedBalances,
            };
        },
        {
            withWalletAuthent: true,
            response: {
                401: t.String(),
                200: t.Object({
                    // Total
                    total: t.TokenAmount,
                    // Details about the balances
                    balances: t.Array(
                        t.Composite([
                            t.TokenAmount,
                            t.Object({
                                token: t.Address(),
                                name: t.String(),
                                symbol: t.String(),
                                decimals: t.Number(),
                                rawBalance: t.Hex(),
                            }),
                        ])
                    ),
                }),
            },
        }
    );
