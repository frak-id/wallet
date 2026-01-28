import { Checkbox } from "@frak-labs/ui/component/forms/Checkbox";
import { format, isBefore, startOfDay } from "date-fns";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { ButtonCalendar } from "@/module/common/component/ButtonCalendar";
import { Calendar } from "@/module/common/component/Calendar";
import { Panel } from "@/module/common/component/Panel";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { CampaignDraft } from "@/stores/campaignStore";
import styles from "./FormSchedule.module.css";

export function FormSchedule() {
    const { control, watch, setValue, getValues } =
        useFormContext<CampaignDraft>();
    const [hasEndDate, setHasEndDate] = useState(false);

    const watchEndDate = watch("scheduled.endDate");

    useEffect(() => {
        setHasEndDate(!!watchEndDate);
    }, [watchEndDate]);

    return (
        <Panel title="Schedule">
            <FormDescription>
                You can choose to run your ads continuously or only during a
                specific period. If you don't set an end date, the campaign will
                stop when the budget is exhausted.
            </FormDescription>

            <FormField
                control={control}
                name="scheduled.startDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Start date (optional)</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <ButtonCalendar>
                                        {field.value ? (
                                            format(field.value, "PPP")
                                        ) : (
                                            <span>
                                                Starts immediately on publish
                                            </span>
                                        )}
                                    </ButtonCalendar>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={(date) => {
                                        field.onChange(date);
                                        if (hasEndDate && date) {
                                            const endDate =
                                                getValues("scheduled.endDate");
                                            if (endDate && date > endDate) {
                                                setValue(
                                                    "scheduled.endDate",
                                                    date
                                                );
                                            }
                                        }
                                    }}
                                    disabled={(date) =>
                                        isBefore(date, startOfDay(new Date()))
                                    }
                                    startMonth={startOfDay(new Date())}
                                />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="scheduled.endDate"
                render={({ field }) => (
                    <>
                        <FormItem
                            variant="checkbox"
                            className={styles.formSchedule__endDate}
                        >
                            <Checkbox
                                onCheckedChange={(checked) => {
                                    setHasEndDate(!!checked);
                                    if (!checked) {
                                        setValue(
                                            "scheduled.endDate",
                                            undefined
                                        );
                                    }
                                }}
                                id="has-end-date"
                                checked={hasEndDate}
                            />
                            <FormLabel
                                variant="checkbox"
                                selected={hasEndDate}
                                htmlFor="has-end-date"
                            >
                                Set an end date
                            </FormLabel>
                        </FormItem>
                        {hasEndDate && (
                            <FormItem>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <ButtonCalendar>
                                                {field.value ? (
                                                    format(field.value, "PPP")
                                                ) : (
                                                    <span>Pick a date</span>
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
                                                const startDate = getValues(
                                                    "scheduled.startDate"
                                                );
                                                const minDate = startDate
                                                    ? new Date(startDate)
                                                    : startOfDay(new Date());
                                                return isBefore(date, minDate);
                                            }}
                                            startMonth={
                                                getValues(
                                                    "scheduled.startDate"
                                                ) ?? new Date()
                                            }
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    </>
                )}
            />
        </Panel>
    );
}
