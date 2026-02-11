import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
import type { Address } from "viem";
import { erc20Abi, formatUnits } from "viem";
import { multicall } from "viem/actions";
import { arbitrum } from "viem/chains";
import type { BankBalanceInfo, V1IndexerProductInfo } from "../types";

const viemClient = getViemClientFromChain({ chain: arbitrum });

export async function fetchBankBalances(
    products: V1IndexerProductInfo[]
): Promise<BankBalanceInfo[]> {
    const banksToCheck: {
        bankAddress: Address;
        tokenAddress: Address;
        productDomain: string;
        productId: string;
    }[] = [];

    for (const product of products) {
        for (const bank of product.banks) {
            banksToCheck.push({
                bankAddress: bank.id,
                tokenAddress: bank.tokenId,
                productDomain: product.product.domain,
                productId: product.product.id,
            });
        }
    }

    if (banksToCheck.length === 0) return [];

    const results = await multicall(viemClient, {
        contracts: banksToCheck.map(
            ({ bankAddress, tokenAddress }) =>
                ({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: "balanceOf",
                    args: [bankAddress],
                }) as const
        ),
    });

    const banksWithBalance: BankBalanceInfo[] = [];
    for (let i = 0; i < results.length; i++) {
        const { result, status } = results[i];
        const bank = banksToCheck[i];

        if (status === "failure" || !result) continue;

        const balance = result as bigint;
        if (balance > 0n) {
            banksWithBalance.push({
                productDomain: bank.productDomain,
                productId: bank.productId,
                bankAddress: bank.bankAddress,
                tokenAddress: bank.tokenAddress,
                balance,
                formattedBalance: formatUnits(balance, 6),
            });
        }
    }

    return banksWithBalance;
}
