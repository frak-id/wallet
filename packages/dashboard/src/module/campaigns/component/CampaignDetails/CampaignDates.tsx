import { getOnChainCampaignsDetails } from "@/context/campaigns/action/getDetails";
import { ActionsMessageSuccess } from "@/module/campaigns/component/Actions";
import styles from "@/module/campaigns/component/Creation/NewCampaign/FormSchedule.module.css";
import { ButtonCalendar } from "@/module/common/component/ButtonCalendar";
import { Calendar } from "@/module/common/component/Calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { referralCampaignAbi } from "@frak-labs/app-essentials";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { Button } from "@module/component/Button";
import { Column, Columns } from "@module/component/Columns";
import { Checkbox } from "@module/component/forms/Checkbox";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, isBefore, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
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

    const {
        mutate: updateDates,
        isPending: isUpdatingDates,
        isSuccess: isSuccessDates,
    } = useMutation({
        mutationKey: ["campaign", "update-date", campaignAddress],
        mutationFn: async ({
            start,
            end,
        }: {
            start: number;
            end: number;
        }) => {
            // Build the function data
            const calldata = encodeFunctionData({
                abi: referralCampaignAbi,
                functionName: "updateActivationPeriod",
                args: [{ start, end }],
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

    const setInitialValues = useCallback(() => {
        if (!onChainInfos) return;
        const dateStart = new Date(onChainInfos.config[1].start * 1000);
        const dateEnd = onChainInfos.config[1].end
            ? new Date(onChainInfos.config[1].end * 1000)
            : undefined;
        return {
            scheduled: {
                dateStart,
                dateEnd,
            },
        };
    }, [onChainInfos]);

    const form = useForm<FormDates>({
        values: useMemo(() => setInitialValues(), [setInitialValues]),
        defaultValues: {
            scheduled: {
                dateStart: new Date(),
            },
        },
    });

    const [isEndDate, setIsEndDate] = useState<boolean | "indeterminate">(
        "indeterminate"
    );

    // Watch the end date to uncheck the end date checkbox
    const watchScheduledEnd = form.watch("scheduled.dateEnd");

    /**
     * Uncheck the end date checkbox
     */
    useEffect(() => {
        setIsEndDate(!!watchScheduledEnd);
    }, [watchScheduledEnd]);

    /**
     * On success, reset the form
     */
    useEffect(() => {
        if (!isSuccessDates) return;
        form.reset(form.getValues());
    }, [isSuccessDates, form.reset, form.getValues]);

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
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Row align={"start"}>
                        <FormField
                            control={form.control}
                            name="scheduled.dateStart"
                            render={({ field }) => {
                                const { value, ...rest } = field;
                                return (
                                    <FormItem>
                                        <FormLabel>Start date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger {...rest} asChild>
                                                <FormControl>
                                                    <ButtonCalendar>
                                                        {field.value ? (
                                                            format(
                                                                field.value,
                                                                "PPP"
                                                            )
                                                        ) : (
                                                            <span>
                                                                Pick a date
                                                            </span>
                                                        )}
                                                    </ButtonCalendar>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={(value) => {
                                                        if (!value) return;
                                                        field.onChange(value);

                                                        // If checkbox is checked, set the end date to the same date
                                                        if (isEndDate) {
                                                            form.setValue(
                                                                "scheduled.dateEnd",
                                                                value
                                                            );
                                                        }
                                                    }}
                                                    disabled={(date) =>
                                                        isBefore(
                                                            date,
                                                            startOfDay(
                                                                new Date()
                                                            )
                                                        )
                                                    }
                                                    startMonth={startOfDay(
                                                        new Date()
                                                    )}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                );
                            }}
                        />

                        <FormField
                            control={form.control}
                            name="scheduled.dateEnd"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>End date</FormLabel>
                                    {isEndDate === true && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <ButtonCalendar>
                                                        {field.value ? (
                                                            format(
                                                                field.value,
                                                                "PPP"
                                                            )
                                                        ) : (
                                                            <span>
                                                                Pick a date
                                                            </span>
                                                        )}
                                                    </ButtonCalendar>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) => {
                                                        const dateStart =
                                                            form.getValues(
                                                                "scheduled.dateStart"
                                                            );
                                                        return (
                                                            isBefore(
                                                                date,
                                                                startOfDay(
                                                                    new Date()
                                                                )
                                                            ) ||
                                                            date <
                                                                new Date(
                                                                    dateStart
                                                                )
                                                        );
                                                    }}
                                                    startMonth={form.getValues(
                                                        "scheduled.dateStart"
                                                    )}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                    <FormMessage />
                                    <FormItem
                                        variant={"checkbox"}
                                        className={styles.formSchedule__endDate}
                                    >
                                        <Checkbox
                                            onCheckedChange={(value) => {
                                                setIsEndDate(value);

                                                // Reset the end date if the checkbox is unchecked
                                                if (value === false) {
                                                    form.setValue(
                                                        "scheduled.dateEnd",
                                                        undefined,
                                                        { shouldDirty: true }
                                                    );
                                                }
                                            }}
                                            id={"is-end-date"}
                                            checked={isEndDate === true}
                                        />
                                        <FormLabel
                                            variant={"checkbox"}
                                            selected={isEndDate === true}
                                            htmlFor={"is-end-date"}
                                        >
                                            Create an end date
                                        </FormLabel>
                                    </FormItem>
                                </FormItem>
                            )}
                        />
                    </Row>
                    <Columns>
                        <Column>
                            {isSuccessDates && <ActionsMessageSuccess />}
                        </Column>
                        <Column>
                            <Button
                                variant={"informationOutline"}
                                onClick={() => form.reset(setInitialValues())}
                                disabled={
                                    isUpdatingDates || !form.formState.isDirty
                                }
                            >
                                Discard Changes
                            </Button>
                            <Button
                                type={"submit"}
                                variant={"submit"}
                                isLoading={isUpdatingDates}
                                disabled={
                                    isUpdatingDates || !form.formState.isDirty
                                }
                            >
                                Validate Dates
                            </Button>
                        </Column>
                    </Columns>
                </form>
            </Form>
        </>
    );
}
