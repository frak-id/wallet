"use client";

import {
    getCreationData,
    saveCampaignDraft,
    updateCampaignState,
} from "@/context/campaigns/action/createCampaign";
import type { Campaign } from "@/types/Campaign";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { Button } from "@frak-labs/shared/module/component/Button";
import { useMutation } from "@tanstack/react-query";
import { tryit } from "radash";
import { useCallback } from "react";
import { createCampaignDraft, extractSearchParams } from "./utils";

/**
 * Multi steps components
 *  -> Validate everything (and thus creating campaign draft)
 *  -> Trigger creation via wallet
 *  -> Success page
 * @returns
 */
export function EmbeddedCreateCampaign() {
    const extracted = extractSearchParams();

    // Hook used to send transaction via the nexus wallet
    const { mutateAsync: sendTransaction, isPending: isPendingTransaction } =
        useSendTransactionAction();

    // Button to exit
    const handleClose = useCallback(() => {
        window.close();
    }, []);

    const {
        mutate: createCampaign,
        isPending: isCreatingCampaign,
        data: createCampaignData,
        error: createCampaignError,
    } = useMutation({
        mutationKey: [
            "embedded",
            "create-campaign",
            extracted.name,
            extracted.productId,
            extracted.cacBrut,
        ],
        mutationFn: async () => {
            const campaignDraft = createCampaignDraft(extracted);
            const { id } = await saveCampaignDraft(campaignDraft);
            const campaign = { ...campaignDraft, id } as Campaign;
            const creationData = await getCreationData(campaign);
            const [, result] = await tryit(() =>
                sendTransaction({
                    metadata: {
                        i18n: {
                            fr: {
                                "sdk.modal.sendTransaction.description": `Créer la campagne ${campaign.title}`,
                            },
                            en: {
                                "sdk.modal.sendTransaction.description": `Create campaign ${campaign.title}`,
                            },
                        },
                    },
                    tx: creationData.tx,
                })
            )();
            if (campaign.id) {
                await updateCampaignState({
                    campaignId: campaign.id,
                    txHash: result?.hash,
                });
            }
            return { campaign, creationData, hash: result?.hash };
        },
    });

    // Step 1: No createCampaignData
    if (!createCampaignData) {
        return (
            <div>
                <h1>Create Campaign</h1>
                <br />
                <p>
                    You will be creating the campaign <b>{extracted.name}</b> on{" "}
                    <b>{extracted.domain}</b>
                </p>
                <ul>
                    <li>
                        <b>Weekly Budget:</b> ${extracted.weeklyBudget}
                    </li>
                    <li>
                        <b>CAC:</b> ${extracted.cacBrut}
                    </li>
                    <li>
                        <b>Ratio referrer/referee:</b> {extracted.ratio}%
                    </li>
                </ul>
                {createCampaignError && (
                    <div style={{ color: "red", margin: "1em 0" }}>
                        <p>
                            Error:{" "}
                            {createCampaignError instanceof Error
                                ? createCampaignError.message
                                : String(createCampaignError)}
                        </p>
                        <Button onClick={handleClose}>Close</Button>
                    </div>
                )}
                {isCreatingCampaign || isPendingTransaction ? (
                    <div style={{ margin: "1em 0" }}>
                        {isCreatingCampaign && (
                            <p>Creating campaign draft...</p>
                        )}
                        {isPendingTransaction && (
                            <p>
                                Waiting for wallet transaction confirmation...
                            </p>
                        )}
                    </div>
                ) : (
                    <Button onClick={() => createCampaign()}>
                        Validate and Create
                    </Button>
                )}
            </div>
        );
    }

    // Step 2: Success state when createCampaignData is present
    return (
        <div>
            <h1>Campaign Created!</h1>
            <br />
            <p>
                Campaign created and deployed on the transaction:
                <br />
                <b>{createCampaignData.hash}</b>
            </p>
            <Button onClick={handleClose}>Close</Button>
        </div>
    );
}
