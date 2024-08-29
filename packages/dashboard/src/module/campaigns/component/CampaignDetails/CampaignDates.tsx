import { getOnChainCampaignsDetails } from "@/context/campaigns/action/getDetails";
import { FormScheduleFields } from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule";
import { Title } from "@/module/common/component/Title";
import { Form } from "@/module/forms/Form";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { referralCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import { Button } from "@module/component/Button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { type Address, encodeFunctionData } from "viem";

type FormDates = {
    scheduled?: {
        dateStart: Date;
        dateEnd?: Date;
    };
};

/**
 * Display the campaign dates
 * @param campaignAddress
 * @constructor
 */
export function CampaignDates({
    campaignAddress,
}: {
    campaignAddress: Address;
}) {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();

    const { data: onChainInfos, isLoading } = useQuery({
        queryKey: ["campaign", "on-chain-details", campaignAddress],
        queryFn: () => getOnChainCampaignsDetails({ campaignAddress }),
    });

    const { mutate: updateDates, isPending: isUpdatingDates } = useMutation({
        mutationKey: ["campaign", "update-date", campaignAddress],
        mutationFn: async ({
            start,
            end,
        }: {
            start: number;
            end: number;
        }) => {
            console.log("Updating dates", start, end);
            // Build the function data
            const calldata = encodeFunctionData({
                abi: referralCampaignAbi,
                functionName: "setActivationDate",
                args: [start, end],
            });

            // Send the transaction
            await sendTransaction({
                tx: {
                    to: campaignAddress,
                    data: calldata,
                },
                metadata: {
                    header: {
                        title: "Update campaign",
                    },
                    context: "Change campaign start and end dates",
                },
            });
        },
    });

    const form = useForm<FormDates>({
        defaultValues: {
            scheduled: {
                dateStart: new Date(),
            },
        },
    });

    useEffect(() => {
        if (!onChainInfos) return;
        if (onChainInfos?.config?.startDate) {
            form.setValue(
                "scheduled.dateStart",
                new Date(onChainInfos.config.startDate * 1000)
            );
        }
        if (onChainInfos?.config?.endDate) {
            form.setValue(
                "scheduled.dateEnd",
                new Date(onChainInfos.config.endDate * 1000)
            );
        }
    }, [onChainInfos, form]);

    function onSubmit(formData: FormDates) {
        updateDates({
            start: (formData.scheduled?.dateStart?.getTime() ?? 0) / 1000,
            end: (formData.scheduled?.dateEnd?.getTime() ?? 0) / 1000,
        });
    }

    if (isLoading) {
        return null;
    }

    return (
        <>
            <Title as={"h3"} size={"small"}>
                Dates
            </Title>
            <div>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <FormScheduleFields {...form} />
                        <Button
                            type={"submit"}
                            variant={"submit"}
                            isLoading={isUpdatingDates}
                            disabled={isUpdatingDates}
                        >
                            Modify Dates
                        </Button>
                    </form>
                </Form>
            </div>
        </>
    );
}
