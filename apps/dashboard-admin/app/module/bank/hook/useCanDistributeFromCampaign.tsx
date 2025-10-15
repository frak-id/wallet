import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { readContract } from "viem/actions";
import { viemClient } from "../../common/lib/blockchain";

export function useCanDistributeFromCampaign({
    bank,
    campaign,
}: {
    bank: Address;
    campaign: Address;
}) {
    const { data, isLoading } = useQuery({
        queryKey: ["bank", "canDistribute", bank, campaign],
        queryFn: () =>
            readContract(viemClient, {
                abi: campaignBankAbi,
                address: bank,
                functionName: "canDistributeToken",
                args: [campaign],
            }),
    });

    return {
        canDistribute: data,
        isLoading,
    };
}
