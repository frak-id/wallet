"use client";

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
import type { Campaign } from "@/types/Campaign";
import { Checkbox } from "@shared/module/component/forms/Checkbox";
import { format, isBefore, startOfDay } from "date-fns";
import { useEffect, useState } from "react";
import type {
    Control,
    FieldValues,
    Path,
    PathValue,
    UseFormReturn,
} from "react-hook-form";
import styles from "./FormSchedule.module.css";

export function FormSchedule(form: UseFormReturn<Campaign>) {
    return (
        <Panel title="Schedule">
            <FormDescription label={"Schedule"}>
                You can choose to run your ads continuously, starting today, or
                only during a specific period.
            </FormDescription>

            <FormDescription label={"Using a global campaign budget"}>
                Ad set schedules affect the allocation of an overall campaign
                budget. Days with greater opportunities have a higher budget. As
                a result, the amount spent daily will fluctuate.
            </FormDescription>

            <FormScheduleFields {...form} />
        </Panel>
    );
}

export function FormScheduleFields<T extends FieldValues>(
    form: UseFormReturn<T>
) {
    const [isEndDate, setIsEndDate] = useState<boolean | "indeterminate">(
        "indeterminate"
    );

    // Watch the end date to uncheck the end date checkbox
    const watchScheduledEnd = form.watch("scheduled.dateEnd" as Path<T>);

    /**
     * Uncheck the end date checkbox
     */
    useEffect(() => {
        setIsEndDate(!!watchScheduledEnd);
    }, [watchScheduledEnd]);

    return (
        <>
            <FormField
                control={form.control as Control<FieldValues>}
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
                                        onSelect={(value) => {
                                            if (!value) return;
                                            field.onChange(value);

                                            // If checkbox is checked, set the end date to the same date
                                            if (isEndDate) {
                                                form.setValue(
                                                    "scheduled.dateEnd" as Path<T>,
                                                    value as PathValue<
                                                        T,
                                                        Path<T>
                                                    >
                                                );
                                            }
                                        }}
                                        disabled={(date) =>
                                            isBefore(
                                                date,
                                                startOfDay(new Date())
                                            )
                                        }
                                        startMonth={startOfDay(new Date())}
                                    />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    );
                }}
            />

            <FormField
                control={form.control as Control<FieldValues>}
                name="scheduled.dateEnd"
                render={({ field }) => (
                    <>
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
                                            "scheduled.dateEnd" as Path<T>,
                                            undefined as PathValue<T, Path<T>>
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
                        {isEndDate === true && (
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
                                                const dateStart =
                                                    form.getValues(
                                                        "scheduled.dateStart" as Path<T>
                                                    );
                                                return (
                                                    isBefore(
                                                        date,
                                                        startOfDay(new Date())
                                                    ) ||
                                                    date < new Date(dateStart)
                                                );
                                            }}
                                            startMonth={form.getValues(
                                                "scheduled.dateStart" as Path<T>
                                            )}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    </>
                )}
            />
        </>
    );
}
