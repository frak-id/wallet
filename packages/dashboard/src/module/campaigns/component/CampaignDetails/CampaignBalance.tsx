import { getOnChainCampaignsDetails } from "@/context/campaigns/action/getDetails";
import { addCampaignFund } from "@/context/campaigns/action/reload";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import { Button } from "@module/component/Button";
import { Input } from "@module/component/forms/Input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { sleep } from "radash";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { type Address, formatEther } from "viem";

type FormBalance = {
    balance: number;
};

/**
 * Display the campaign balance
 * @param campaignAddress
 * @constructor
 */
export function CampaignBalance({
    campaignAddress,
}: {
    campaignAddress: Address;
}) {
    const {
        data: onChainInfos,
        isLoading,
        refetch: refreshOnChainInfos,
    } = useQuery({
        queryKey: ["campaign", "on-chain-details", campaignAddress],
        queryFn: () => getOnChainCampaignsDetails({ campaignAddress }),
    });

    const { mutate: addFundRequest, isPending: isAddingFund } = useMutation({
        mutationKey: ["campaign", "add-fund", campaignAddress],
        mutationFn: async () => {
            // Launch the request
            await addCampaignFund({ campaignAddress });
            // Wait a bit
            await sleep(5_000);
            // Refresh on chain info
            await refreshOnChainInfos();
        },
    });

    const form = useForm<FormBalance>({
        defaultValues: {
            balance: 0,
        },
    });

    useEffect(() => {
        if (!onChainInfos) return;
        form.setValue(
            "balance",
            Number(formatEther(BigInt(onChainInfos.balance)))
        );
    }, [onChainInfos, form]);

    function onSubmit(formData: FormBalance) {
        console.log(formData);
        addFundRequest();
    }

    if (isLoading) {
        return null;
    }

    return (
        <>
            <Title as={"h3"} size={"small"}>
                Balance
            </Title>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormField
                        control={form.control}
                        name="balance"
                        rules={{
                            validate: {
                                required: (value) =>
                                    value > 0 || "Invalid balance",
                            },
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Row>
                                        <Input
                                            length={"medium"}
                                            placeholder={"Domain Name...."}
                                            disabled={isAddingFund}
                                            {...field}
                                        />
                                        <Button
                                            type={"submit"}
                                            variant={"submit"}
                                            isLoading={isAddingFund}
                                            disabled={isAddingFund}
                                        >
                                            Add Funds
                                        </Button>
                                    </Row>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
        </>
    );
}
