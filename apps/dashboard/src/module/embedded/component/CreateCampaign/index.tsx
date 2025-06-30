"use client";

import {
    saveCampaignDraft,
    updateCampaignState,
} from "@/context/campaigns/action/createCampaign";
import { getCreationData } from "@/context/campaigns/action/createOnChain";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useHasRoleOnProduct } from "@/module/common/hook/useHasRoleOnProduct";
import type { Campaign } from "@/types/Campaign";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMutation } from "@tanstack/react-query";
import { tryit } from "radash";
import { useCallback } from "react";
import styles from "../Mint/index.module.css";
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

    const { isOwner, isAdministrator, isCampaignManager } = useHasRoleOnProduct(
        {
            productId: extracted.productId,
        }
    );

    // Step 0: Check if the product is deployed and if the user is allowed on this product
    if (!isOwner && !isAdministrator && !isCampaignManager) {
        return (
            <>
                <Title className={styles.title}>Create Campaign</Title>
                <Panel
                    withBadge={false}
                    title={`Creating campaign ${extracted.name}`}
                >
                    <div className={styles.error}>
                        <p>
                            You are not allowed to create a campaign on this
                            product
                        </p>
                        <Button
                            variant="secondary"
                            size="small"
                            className={styles.button}
                            onClick={handleClose}
                        >
                            Close
                        </Button>
                    </div>
                </Panel>
            </>
        );
    }

    // Step 1: No createCampaignData
    if (!createCampaignData) {
        return (
            <>
                <Title className={styles.title}>Create Campaign</Title>
                <Panel
                    withBadge={false}
                    title={`Creating campaign ${extracted.name}`}
                >
                    <p>
                        You will be creating the campaign{" "}
                        <b>{extracted.name}</b> on <b>{extracted.domain}</b>
                    </p>
                    <ul className={styles.list}>
                        <li className={styles.listItem}>
                            <b>Budget type:</b> {extracted.budget.type}
                        </li>
                        <li className={styles.listItem}>
                            <b>Budget amount:</b>
                            {extracted.budget.maxEuroDaily}
                        </li>
                        <li className={styles.listItem}>
                            <b>CAC:</b> {extracted.cacBrut}
                        </li>
                        <li className={styles.listItem}>
                            <b>Ratio referrer/referee:</b> {extracted.ratio}%
                        </li>
                        <li className={styles.listItem}>
                            <b>Setup currency:</b>{" "}
                            {!extracted.setupCurrency ||
                            extracted.setupCurrency === "raw"
                                ? "usd"
                                : extracted.setupCurrency}
                        </li>
                    </ul>
                    {createCampaignError && (
                        <div className={styles.error}>
                            <p>
                                Error:{" "}
                                {createCampaignError instanceof Error
                                    ? createCampaignError.message
                                    : String(createCampaignError)}
                            </p>
                            <Button
                                variant="secondary"
                                size="small"
                                className={styles.button}
                                onClick={handleClose}
                            >
                                Close
                            </Button>
                        </div>
                    )}
                    <Button
                        variant="secondary"
                        className={styles.button}
                        onClick={() => createCampaign()}
                        disabled={isCreatingCampaign || isPendingTransaction}
                    >
                        {isCreatingCampaign || isPendingTransaction ? (
                            <>
                                <Spinner />
                                {isCreatingCampaign && "Creating campaign..."}
                                {isPendingTransaction &&
                                    "Waiting for wallet transaction confirmation..."}
                            </>
                        ) : (
                            "Validate and Create"
                        )}
                    </Button>
                </Panel>
            </>
        );
    }

    if (!createCampaignData?.hash) {
        return (
            <>
                <Title className={styles.title}>Campaign not deployed!</Title>
                <Panel
                    withBadge={false}
                    title={"Campaign created but not deployed"}
                >
                    <Button
                        variant="secondary"
                        size="small"
                        className={styles.button}
                        onClick={handleClose}
                    >
                        Close
                    </Button>
                </Panel>
            </>
        );
    }

    // Step 2: Success state when createCampaignData is present
    return (
        <>
            <Title className={styles.title}>Campaign Created!</Title>
            <Panel
                withBadge={false}
                title={"Campaign created and deployed on the transaction:"}
            >
                <p>
                    <b>{createCampaignData.hash}</b>
                </p>
                <Button
                    variant="secondary"
                    size="small"
                    className={styles.button}
                    onClick={handleClose}
                >
                    Close
                </Button>
            </Panel>
        </>
    );
}
