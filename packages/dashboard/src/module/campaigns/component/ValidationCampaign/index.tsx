"use client";

import {
    saveCampaign,
    updateCampaignState,
} from "@/context/campaigns/action/createCampaign";
import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { campaignSuccessAtom } from "@/module/campaigns/atoms/steps";
import { ButtonCancel } from "@/module/campaigns/component/NewCampaign/ButtonCancel";
import { FormCheck } from "@/module/campaigns/component/ValidationCampaign/FormCheck";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { Actions } from "@/module/forms/Actions";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { tryit } from "radash";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { Hex } from "viem";
import styles from "./index.module.css";

export function ValidationCampaign() {
    const [campaign, setCampaign] = useAtom(campaignAtom);
    const [campaignSuccess, setCampaignSuccess] = useAtom(campaignSuccessAtom);
    const [txHash, setTxHash] = useState<Hex | undefined>();

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

                setTxHash(result?.hash);
                setCampaignSuccess(true);
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
                        disabled={campaignSuccess}
                    />
                }
            />
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit((campaign) =>
                        createCampaign(campaign)
                    )}
                >
                    {!campaignSuccess && <FormCheck {...form} />}
                    {campaignSuccess && (
                        <Panel title="Campaign creation success">
                            <p className={styles.validationCampaign__message}>
                                Your campaign was successfully created !
                            </p>
                            {txHash && <p>Transaction hash: {txHash}</p>}
                        </Panel>
                    )}
                    <Actions
                        isLoading={
                            isPendingTransaction || isPendingCreateCampaign
                        }
                    />
                </form>
            </Form>
        </FormLayout>
    );
}
