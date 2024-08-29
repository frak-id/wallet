import { getOnChainCampaignsDetails } from "@/context/campaigns/action/getDetails";
import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { CampaignBalance } from "@/module/campaigns/component/CampaignDetails/CampaignBalance";
import { CampaignDates } from "@/module/campaigns/component/CampaignDetails/CampaignDates";
import { Column } from "@/module/common/component/Column";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useQuery } from "@tanstack/react-query";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { useMemo } from "react";
import type { Address, Hex } from "viem";
import styles from "./CampaignStatus.module.css";

const statusVariants = cva(styles.campaignStatus__status, {
    variants: {
        variant: {
            loading: styles.loading,
            paused: styles.paused,
            active: styles.active,
            stopped: styles.stopped,
        },
    },
});
type StatusVariantProps = VariantProps<typeof statusVariants>["variant"];

/**
 * Display the campaign status
 * @param campaign
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
    const status = useMemo<{
        label: string;
        variant: StatusVariantProps;
    }>(() => {
        if (state === "draft") {
            return { label: "Draft", variant: "paused" };
        }

        return { label: "Creation failed", variant: "stopped" };
    }, [state]);

    return (
        <p>
            Status:{" "}
            <span
                className={statusVariants({
                    variant: status.variant,
                })}
            >
                {status.label}
            </span>
        </p>
    );
}

function OnChainCampaignStatus({
    campaignAddress,
    deploymentTxHash,
}: { campaignAddress: Address; deploymentTxHash: Hex }) {
    const { data: onChainInfos, isLoading } = useQuery({
        queryKey: ["campaign", "on-chain-details", campaignAddress],
        queryFn: () => getOnChainCampaignsDetails({ campaignAddress }),
    });

    const status = useMemo<{
        label: string;
        variant: StatusVariantProps;
    }>(() => {
        if (!onChainInfos) {
            return { label: "Loading", variant: "loading" };
        }

        if (!onChainInfos.isRunning) {
            return { label: "Paused", variant: "paused" };
        }

        if (!onChainInfos.isActive) {
            return { label: "Stopped", variant: "stopped" };
        }

        return { label: "Active", variant: "active" };
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
            <Column fullWidth={true}>
                <h3>Campaign status</h3>
                <p>Campaign Address: {campaignAddress}</p>
                <p>Deployment Tx Hash: {deploymentTxHash}</p>
                <p>On-chain information's not found</p>
            </Column>
        );
    }

    return (
        <>
            <Column fullWidth={true}>
                <Title as={"h3"} size={"small"}>
                    Campaign status
                </Title>
                <div>
                    <p>Campaign Address: {campaignAddress}</p>
                    <p>Deployment Tx Hash: {deploymentTxHash}</p>
                    <br />
                    <p>
                        Status:{" "}
                        <span
                            className={statusVariants({
                                variant: status.variant,
                            })}
                        >
                            {status.label}
                        </span>
                    </p>
                </div>
            </Column>
            <Column fullWidth={true}>
                <CampaignBalance campaignAddress={campaignAddress} />
            </Column>
            <Column fullWidth={true}>
                <CampaignDates campaignAddress={campaignAddress} />
            </Column>
        </>
    );
}
