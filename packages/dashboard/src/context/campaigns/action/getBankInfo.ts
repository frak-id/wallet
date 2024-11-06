"use server";

import { viemClient } from "@/context/blockchain/provider";
import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { LRUCache } from "lru-cache";
import { type Address, erc20Abi } from "viem";
import { readContract } from "viem/actions";

type BankInfo = {
    token?: Address;
    decimals: number;
};

const bankInfoCache = new LRUCache<Address, BankInfo>({
    max: 1024,
});

/**
 * Get a bank token decimals
 * @param bank
 */
export async function getBankTokenInfo({ bank }: { bank: Address }) {
    if (!bank) {
        return { decimals: 18 };
    }
    // Get a potentially cached value
    const cached = bankInfoCache.get(bank);
    if (cached) {
        return cached;
    }
    // Get the bank token
    const [, token] = await readContract(viemClient, {
        abi: campaignBankAbi,
        address: bank,
        functionName: "getConfig",
    });
    // Get the token decimal count
    const decimals = await readContract(viemClient, {
        abi: erc20Abi,
        address: token,
        functionName: "decimals",
    });
    // Save it in cache for further use
    bankInfoCache.set(bank, { token, decimals });
    // Return the data
    return {
        token,
        decimals,
    };
}
