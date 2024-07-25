"use client";

import { getOnChainCampaignsDetails } from "@/context/campaigns/action/getDetails";
import { reloadCampaign } from "@/context/campaigns/action/reload";
import type { CampaignState } from "@/context/campaigns/dto/CampaignDocument";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";

/**
 * Display some info about an on chain campaign
 * @param campaign
 * @constructor
 */
export function OnChainCampaignInfo({
    state,
}: {
    state: Extract<CampaignState, { key: "created" }>;
}) {
    const { data: onChainInfos, isLoading } = useQuery({
        queryKey: ["campaign", "on-chain-details", state.address],
        queryFn: () =>
            getOnChainCampaignsDetails({ campaignAddress: state.address }),
    });

    const { mutate, status: reloadRequestStatus } = useMutation({
        mutationKey: ["campaign", "ask-reload-details", state.address],
        mutationFn: () => reloadCampaign({ campaignAddress: state.address }),
    });

    if (isLoading || !onChainInfos) {
        return <>Loading on-chain information's...</>;
    }

    return (
        <>
            Deployed at address: {state.address}
            <br />
            Deployment tx hash: {state.txHash}
            <br />
            <hr />
            IsActive: {onChainInfos.isActive ? "Yes" : "No"}
            <br />
            IsAllowedToEdit: {onChainInfos.isAllowedToEdit ? "Yes" : "No"}
            <br />
            Balance: {formatEther(BigInt(onChainInfos.balance))}
            <br />
            Type: {onChainInfos.metadata[0]}
            <br />
            Version: {onChainInfos.metadata[1]}
            <br />
            <hr />
            <button onClick={() => mutate()} type={"button"}>
                Reload
            </button>
            <br />
            Reload request status: {reloadRequestStatus}
        </>
    );
}
