"use client";
import {
    saveCampaign,
    updateCampaignState,
} from "@/context/campaigns/action/createCampaign";
import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { campaignStepAtom } from "@/module/campaigns/atoms/steps";
import { ButtonCancel } from "@/module/campaigns/component/NewCampaign/ButtonCancel";
import { FormCheck } from "@/module/campaigns/component/ValidationCampaign/FormCheck";
import { Head } from "@/module/common/component/Head";
import { Actions } from "@/module/forms/Actions";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useMutation } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import { tryit } from "radash";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

export function ValidationCampaign() {
    const setStep = useSetAtom(campaignStepAtom);
    const [campaign, setCampaign] = useAtom(campaignAtom);

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

                // Once all good, back to previous state
                setStep((prev) => prev + 1);
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
                    <ButtonCancel onClick={() => form.reset(campaign)} />
                }
            />
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit((campaign) =>
                        createCampaign(campaign)
                    )}
                >
                    <FormCheck {...form} />
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
