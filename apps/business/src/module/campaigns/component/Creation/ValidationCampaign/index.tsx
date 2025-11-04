import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { tryit } from "radash";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { Hex, TransactionReceipt } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { viemClient } from "@/context/blockchain/provider";
import {
    saveCampaignDraft,
    updateCampaignState,
} from "@/context/campaigns/action/createCampaign";
import { getCreationData } from "@/context/campaigns/action/createOnChain";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { FormCheck } from "@/module/campaigns/component/Creation/ValidationCampaign/FormCheck";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { Form, FormLayout } from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";
import { currencyStore } from "@/stores/currencyStore";
import type { Campaign } from "@/types/Campaign";
import styles from "./index.module.css";

export function ValidationCampaign() {
    const navigate = useNavigate();
    const campaign = campaignStore((state) => state.campaign);
    const setCampaign = campaignStore((state) => state.setCampaign);
    const campaignSuccess = campaignStore((state) => state.success);
    const setSuccess = campaignStore((state) => state.setSuccess);
    const isClosing = campaignStore((state) => state.isClosing);
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);
    const [txHash, setTxHash] = useState<Hex | undefined>();
    const save = useSaveCampaign();
    const isDemoMode = useIsDemoMode();

    // Hook used to send transaction via the nexus wallet
    const { mutateAsync: sendTransaction, isPending: isPendingTransaction } =
        useSendTransactionAction();

    // Perform the campaign creation
    const { mutate: createCampaign, isPending: isPendingCreateCampaign } =
        useMutation({
            mutationKey: ["campaign", "create"],
            mutationFn: async (campaign: Campaign) => {
                // In demo mode, just simulate success
                if (isDemoMode) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    setSuccess(true);
                    return;
                }

                const campaignWithCurrency = {
                    ...campaign,
                    setupCurrency: preferredCurrency,
                };
                // Save it in the database
                const { id } = await saveCampaignDraft({
                    data: { campaign: campaignWithCurrency },
                });
                if (!id) {
                    throw new Error("Unable to save campaign draft");
                }
                const newCampaign = {
                    ...campaignWithCurrency,
                    id,
                };
                // Update the atom
                setCampaign(newCampaign);
                // Build the creation data
                const { tx } = await getCreationData({
                    data: { campaign: newCampaign },
                });

                // Send the campaign creation transaction
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
                        tx,
                    })
                )();
                await updateCampaignState({
                    data: {
                        campaignId: id,
                        txHash: result?.hash,
                    },
                });

                if (!result) return;
                setTxHash(result?.hash);
                setSuccess(true);
            },
        });

    const {
        isLoading: isWaitingForFinalisedCreation,
        data: transactionReceipt,
    } = useQuery({
        queryKey: ["campaign", "wait-for-finalised-deployment"],
        enabled: !!txHash,
        queryFn: async () => {
            if (!txHash) return null;
            // We are waiting for the block with the tx hash to have at least 32 confirmations,
            //  it will leave the time for the indexer to process it + the time for the block to be finalised
            return await waitForTransactionReceipt(viemClient, {
                hash: txHash,
                confirmations: 32,
                retryCount: 32,
            });
        },
    });

    const form = useForm<Campaign>({
        values: useMemo(() => campaign, [campaign]),
    });

    return (
        <FormLayout>
            <Head
                title={{ content: "Campaign Validation", size: "small" }}
                rightSection={
                    <ButtonCancel
                        onClick={() => form.reset(campaign)}
                        disabled={
                            campaignSuccess || isWaitingForFinalisedCreation
                        }
                    />
                }
            />
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(async (campaign) => {
                        // If the campaign is already a success, we don't need to do anything
                        if (campaignSuccess && !isWaitingForFinalisedCreation) {
                            navigate({ to: "/campaigns/list" });
                            return;
                        }

                        // If the user click on close button, we save it and return
                        if (isClosing) {
                            await save(campaign);
                            return;
                        }

                        // Otherwise, we create the campaign
                        createCampaign(campaign);
                    })}
                >
                    {!campaignSuccess && <FormCheck {...form} />}
                    <CampaignSuccessInfo
                        txHash={txHash}
                        isCreated={campaignSuccess}
                        isWaitingForFinalisedCreation={
                            isWaitingForFinalisedCreation
                        }
                        receipt={transactionReceipt}
                    />
                    <Actions
                        isLoading={
                            isPendingTransaction ||
                            isPendingCreateCampaign ||
                            isWaitingForFinalisedCreation
                        }
                    />
                </form>
            </Form>
        </FormLayout>
    );
}

/**
 * If created but waiting for finalised, show a spinner
 *  Once finalised and success, show txHash + success message
 */
function CampaignSuccessInfo({
    txHash,
    isCreated,
    isWaitingForFinalisedCreation,
    receipt,
}: {
    txHash?: Hex;
    isCreated: boolean;
    isWaitingForFinalisedCreation: boolean;
    receipt?: TransactionReceipt | null;
}) {
    if (!isCreated) return null;

    if (isCreated && isWaitingForFinalisedCreation && !receipt) {
        return (
            <Panel title="Campaign creation in progress">
                <p>
                    Setting all the right blockchain data
                    <span className={"dotsLoading"}>...</span>
                </p>
            </Panel>
        );
    }

    return (
        <Panel title="Campaign creation success">
            <p className={styles.validationCampaign__message}>
                Your campaign was successfully created !
            </p>
            <br />
            {txHash && <p>Transaction hash: {txHash}</p>}
        </Panel>
    );
}
