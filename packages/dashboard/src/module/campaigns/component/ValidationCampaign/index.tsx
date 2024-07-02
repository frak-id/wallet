"use client";
import { addresses } from "@/context/blockchain/addresses";
import {
    saveCampaign,
    updateCampaignState,
} from "@/context/campaigns/action/createCampaign";
import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import { campaignStepAtom } from "@/module/campaigns/atoms/steps";
import { FormCheck } from "@/module/campaigns/component/ValidationCampaign/FormCheck";
import { Button } from "@/module/common/component/Button";
import { Head } from "@/module/common/component/Head";
import { Actions } from "@/module/forms/Actions";
import { Form, FormLayout } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { useMutation } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { tryit } from "radash";
import { useForm } from "react-hook-form";

export function ValidationCampaign() {
    const router = useRouter();
    const setStep = useSetAtom(campaignStepAtom);
    const [campaign, setCampaign] = useAtom(campaignAtom);

    // Hook used to send transaction via the nexus wallet
    const { mutateAsync: sendTransaction } = useSendTransactionAction();

    const { mutate: createCampaign } = useMutation({
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
                    context: `Create campaign ${campaign.title}`,
                    tx: {
                        to: addresses.contentInteractionManager,
                        value: "0x00",
                        data: creationData,
                    },
                })
            )();
            await updateCampaignState({ campaignId: id, txHash: result?.hash });

            // Once all good, back to previous state
            setStep((prev) => prev + 1);
        },
    });

    const form = useForm<Campaign>({
        defaultValues: campaign,
    });

    return (
        <FormLayout>
            <Head
                title={{ content: "Campaign Validation", size: "small" }}
                rightSection={
                    <Button
                        variant={"outline"}
                        leftIcon={<X size={20} />}
                        onClick={() => router.push("/campaigns")}
                    >
                        Cancel
                    </Button>
                }
            />
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit((campaign) =>
                        createCampaign(campaign)
                    )}
                >
                    <FormCheck {...form} />
                    <Actions />
                </form>
            </Form>
        </FormLayout>
    );
}
