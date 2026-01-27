import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMutation } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { tryit } from "radash";
import { useCallback } from "react";
import {
    saveCampaignDraft,
    updateCampaignState,
} from "@/context/campaigns/action/createCampaign";
import { getCreationData } from "@/context/campaigns/action/createOnChain";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useHasRoleOnMerchant } from "@/module/common/hook/useHasRoleOnProduct";
import type { Campaign } from "@/types/Campaign";
import styles from "../Mint/index.module.css";
import { createCampaignDraft, extractSearchParams } from "./utils";

export function EmbeddedCreateCampaign() {
    const search = useSearch({ from: "/embedded/_layout/create-campaign" });
    const extracted = extractSearchParams(search);

    const { mutateAsync: sendTransaction, isPending: isPendingTransaction } =
        useSendTransactionAction();

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
            extracted.merchantId,
            extracted.cacBrut,
        ],
        mutationFn: async () => {
            const campaignDraft = createCampaignDraft(extracted);
            const { id } = await saveCampaignDraft({
                data: { campaign: campaignDraft },
            });
            const campaign = { ...campaignDraft, id } as Campaign;
            const creationData = await getCreationData({ data: { campaign } });
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
                    data: {
                        campaignId: campaign.id,
                        txHash: result?.hash,
                    },
                });
            }
            return { campaign, creationData, hash: result?.hash };
        },
    });

    const { isOwner, isAdministrator, isCampaignManager } =
        useHasRoleOnMerchant({
            merchantId: extracted.merchantId ?? extracted.productId ?? "",
        });

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
                            <b>Budget amount:</b>{" "}
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
