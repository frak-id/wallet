import { pricingRepository, sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { toHex } from "viem";
import { WalletContext } from "../../../domain/wallet";
import { BalanceResponseSchema } from "../../schemas";

export const balanceRoutes = new Elysia({ prefix: "/balance" })
    .use(sessionContext)
    .get(
        "",
        async ({ walletSession }) => {
            const balances =
                await WalletContext.repositories.balances.getUserBalance({
                    address: walletSession.address,
                });

            const mappedBalances = await Promise.all(
                balances.map(async (tokenBalance) => {
                    const price = await pricingRepository.getTokenPrice({
                        token: tokenBalance.contractAddress,
                    });

                    return {
                        token: tokenBalance.contractAddress,
                        name: tokenBalance.metadata.name,
                        symbol: tokenBalance.metadata.symbol,
                        decimals: tokenBalance.metadata.decimals,
                        rawBalance: toHex(tokenBalance.rawBalance),
                        amount: tokenBalance.balance,
                        eurAmount: price ? tokenBalance.balance * price.eur : 0,
                        usdAmount: price ? tokenBalance.balance * price.usd : 0,
                        gbpAmount: price ? tokenBalance.balance * price.gbp : 0,
                    };
                })
            );

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
                200: BalanceResponseSchema,
            },
        }
    );
