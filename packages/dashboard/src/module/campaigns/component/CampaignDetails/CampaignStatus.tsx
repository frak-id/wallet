import { getOnChainCampaignsDetails } from "@/context/campaigns/action/getDetails";
import { addCampaignFund } from "@/context/campaigns/action/reload";
import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { Panel } from "@/module/common/component/Panel";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { referralCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import { useMutation, useQuery } from "@tanstack/react-query";
import { sleep } from "radash";
import { useMemo } from "react";
import { type Address, type Hex, encodeFunctionData, formatEther } from "viem";

/**
 * Display the campaign status
 * @param campaignId
 * @constructor
 */
export function CampaignStatus({
    campaign,
}: {
    campaign: CampaignDocument;
}) {
    return (
        <Panel title={campaign.title ?? "Campaign information's"}>
            {campaign.state.key !== "created" && (
                <OffChainCampaignStatus state={campaign.state.key} />
            )}
            {campaign.state.key === "created" && (
                <OnChainCampaignStatus
                    campaignAddress={campaign.state.address}
                    deploymentTxHash={campaign.state.txHash}
                />
            )}
        </Panel>
    );
}

function OffChainCampaignStatus({
    state,
}: { state: "draft" | "creationFailed" }) {
    return (
        <p>
            Status: <strong>{state}</strong>
        </p>
    );
}

function OnChainCampaignStatus({
    campaignAddress,
    deploymentTxHash,
}: { campaignAddress: Address; deploymentTxHash: Hex }) {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();

    const {
        data: onChainInfos,
        isLoading,
        refetch: refreshOnChainInfos,
    } = useQuery({
        queryKey: ["campaign", "on-chain-details", campaignAddress],
        queryFn: () => getOnChainCampaignsDetails({ campaignAddress }),
    });

    const { mutate: addFundRequest, isPending: isAddingFund } = useMutation({
        mutationKey: ["campaign", "add-fund", campaignAddress],
        mutationFn: async () => {
            // Launch the request
            await addCampaignFund({ campaignAddress });
            // Wait a bit
            await sleep(5_000);
            // Refresh on chain info
            await refreshOnChainInfos();
        },
    });

    const { mutate: updateDates, isPending: isUpdatingDates } = useMutation({
        mutationKey: ["campaign", "update-date", campaignAddress],
        mutationFn: async () => {
            // Build the function data
            const calldata = encodeFunctionData({
                abi: referralCampaignAbi,
                functionName: "setActivationDate",
                // todo: first arg start timestamp in second
                // todo: second arg end timestamp in second
                args: [0, 0],
            });

            // Send the transaction
            await sendTransaction({
                tx: {
                    to: campaignAddress,
                    data: calldata,
                },
                metadata: {
                    header: {
                        title: "Update campaign",
                    },
                    context: "Change campaign start and end dates",
                },
            });
        },
    });

    const status = useMemo(() => {
        if (!onChainInfos) {
            return "Loading";
        }

        if (!onChainInfos.isRunning) {
            return "Paused";
        }

        if (!onChainInfos.isActive) {
            return "Stopped";
        }

        return "Running";
    }, [onChainInfos]);

    if (isLoading) {
        return (
            <>
                Loading on-chain information's
                <span className={"dotsLoading"}>...</span>
            </>
        );
    }

    if (!onChainInfos) {
        return (
            <>
                <h3>Campaign status</h3>
                <p>
                    Deployed at: <pre>{campaignAddress}</pre>
                </p>
                <p>
                    Deployed on transaction: <pre>{deploymentTxHash}</pre>
                </p>
                <p>On-chain information's not found</p>
            </>
        );
    }

    return (
        <>
            <h3>Campaign status</h3>
            <p>
                Deployed at: <pre>{campaignAddress}</pre>
            </p>
            <p>
                Deployed on transaction: <pre>{deploymentTxHash}</pre>
            </p>
            <br />
            <p>
                Status: <strong>{status}</strong>
            </p>

            <h3>Balance</h3>
            <p>{formatEther(BigInt(onChainInfos.balance))}</p>
            <button
                onClick={() => addFundRequest()}
                type={"button"}
                disabled={isAddingFund}
            >
                Reload
            </button>

            <h3>Dates</h3>
            <p>Start: {onChainInfos?.config?.startDate}</p>
            <p>End: {onChainInfos?.config?.endDate}</p>
            <button
                onClick={() => updateDates()}
                type={"button"}
                disabled={isUpdatingDates}
            >
                Update dates
            </button>
        </>
    );
}
