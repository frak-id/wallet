"use client";

import { viemClient } from "@/context/blockchain/provider";
import {
    saveCampaign,
    updateCampaignState,
} from "@/context/campaigns/action/createCampaign";
import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import {
    campaignIsClosingAtom,
    campaignSuccessAtom,
} from "@/module/campaigns/atoms/steps";
import { ButtonCancel } from "@/module/campaigns/component/NewCampaign/ButtonCancel";
import { FormCheck } from "@/module/campaigns/component/ValidationCampaign/FormCheck";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { Actions } from "@/module/forms/Actions";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { Spinner } from "@module/component/Spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtom, useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { tryit } from "radash";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { Hex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import styles from "./index.module.css";

export function ValidationCampaign() {
    const router = useRouter();
    const [campaign, setCampaign] = useAtom(campaignAtom);
    const [campaignSuccess, setCampaignSuccess] = useAtom(campaignSuccessAtom);
    const [txHash, setTxHash] = useState<Hex | undefined>();
    const save = useSaveCampaign();
    const campaignIsClosing = useAtomValue(campaignIsClosingAtom);

    // Hook used to send transaction via the nexus wallet
    const { mutateAsync: sendTransaction, isPending: isPendingTransaction } =
        useSendTransactionAction();

    const { mutate: createCampaign, isPending: isPendingCreateCampaign } =
        useMutation({
            mutationKey: ["campaign", "create"],
            mutationFn: async (campaign: Campaign) => {
                // Save it
                console.log(campaign);
                setCampaign(campaign);

                // Save it in the database
                const { id, creationData } = await saveCampaign(campaign);

                // Send the campaign creation transaction
                const [, result] = await tryit(() =>
                    sendTransaction({
                        metadata: {
                            context: `Create campaign ${campaign.title}`,
                        },
                        tx: {
                            to: addresses.contentInteractionManager,
                            value: "0x00",
                            data: creationData,
                        },
                    })
                )();
                await updateCampaignState({
                    campaignId: id,
                    txHash: result?.hash,
                });

                if (!result) return;
                setTxHash(result?.hash);
                setCampaignSuccess(true);
            },
        });

    const { isLoading: isWaitingForFinalisedCreation } = useQuery({
        queryKey: ["campaign", "wait-for-finalised-deployment"],
        enabled: !!txHash,
        queryFn: async () => {
            if (!txHash) return null;
            // We are waiting for the block with the tx hash to have at least 64 confirmations,
            //  it will leave the time for the indexer to process it + the time for the block to be finalised
            await waitForTransactionReceipt(viemClient, {
                hash: txHash,
                confirmations: 32,
            });
        },
    });

    const form = useForm<Campaign>({
        defaultValues: campaign,
    });

    /**
     * Populate the form with campaign atom
     */
    useEffect(() => {
        form.reset(campaign);
    }, [campaign, form.reset]);

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
                            router.push("/campaigns");
                            return;
                        }

                        // If the user click on close button, we save it and return
                        if (campaignIsClosing) {
                            await save(campaign);
                            return;
                        }

                        // Otherwise, we create the campaign
                        createCampaign(campaign);
                    })}
                >
                    {!campaignSuccess && <FormCheck {...form} />}
                    {campaignSuccess && (
                        <Panel title="Campaign creation success">
                            <p className={styles.validationCampaign__message}>
                                Your campaign was successfully created !
                            </p>
                            <br />
                            {isWaitingForFinalisedCreation && (
                                <p>
                                    <Spinner /> We are waiting for the campaign
                                    to be finalised
                                </p>
                            )}
                            {txHash && <p>Transaction hash: {txHash}</p>}
                        </Panel>
                    )}
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
