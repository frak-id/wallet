import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useQuery } from "@tanstack/react-query";
import { type Address, erc20Abi, isAddress } from "viem";
import { readContract } from "viem/actions";
import { viemClient } from "@/context/blockchain/provider";

/**
 * Get the bank information
 */
export function useGetBankInfo({ bank }: { bank?: Address | "" }) {
    const query = useQuery({
        enabled: !!bank,
        queryKey: ["bank", "info", bank],
        queryFn: async () => {
            if (!bank || !isAddress(bank)) {
                return null;
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
            // Return the data
            return {
                token,
                decimals,
            };
        },
    });

    if (query.error) {
        console.error(query.error);
    }
    if (query.data) {
        console.log("data for bank", { data: query.data, bank });
    }

    return {
        bankInfo: query.data,
        ...query,
    };
}
