"use client";

import { contentInteractionManagerAbi } from "@/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@/context/blockchain/addresses";
import { saveCampaign } from "@/context/campaigns/action/createCampaign";
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
import { useForm } from "react-hook-form";
import { encodeFunctionData } from "viem";

export function ValidationCampaign() {
    const router = useRouter();
    const setStep = useSetAtom(campaignStepAtom);
    const [campaign, setCampaign] = useAtom(campaignAtom);

    // todo: Should expose a more proper hook (pending not returning, error wrapped in Nexus error and finishing with success state)
    const { mutateAsync: sendTransaction } = useSendTransactionAction({
        callback: (data) => {
            // todo: Handle tx properly (error, pending and stuff)
            console.log("Sending tx data", data);
        },
    });

    const { mutate: createCampaign } = useMutation({
        mutationKey: ["campaign", "create"],
        mutationFn: async (campaign: Campaign) => {
            // Save it
            console.log(campaign);
            setCampaign(campaign);

            // Save it in the database
            await saveCampaign(campaign);

            // Send the campaign creation transaction
            await sendTransaction({
                context: `Create campaign ${campaign.title}`,
                tx: {
                    to: addresses.contentInteractionManager,
                    value: "0x00",
                    data: encodeFunctionData({
                        abi: contentInteractionManagerAbi,
                        functionName: "getInteractionContract",
                        args: [
                            106219508196454080375526586478153583586194937194493887259467424694676997453395n,
                        ],
                    }),
                },
            });

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
                <form onSubmit={form.handleSubmit(createCampaign)}>
                    <FormCheck {...form} />
                    <Actions />
                </form>
            </Form>
        </FormLayout>
    );
}
