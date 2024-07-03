"use client";

import { Calendar } from "@/module/common/component/Calendar";
import { Panel } from "@/module/common/component/Panel";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import { Checkbox } from "@/module/forms/Checkbox";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Button } from "@module/component/Button";
import { format, isBefore, startOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import styles from "./FormSchedule.module.css";

export function FormSchedule(form: UseFormReturn<Campaign>) {
    const [isEndDate, setIsEndDate] = useState<boolean | "indeterminate">(
        "indeterminate"
    );

    return (
        <Panel title="Schedule">
            <FormDescription title={"Schedule"}>
                You can choose to run your ads continuously, starting today, or
                only during a specific period.
            </FormDescription>

            <FormDescription title={"Using a global campaign budget"}>
                Ad set schedules affect the allocation of an overall campaign
                budget. Days with greater opportunities have a higher budget. As
                a result, the amount spent daily will fluctuate.
            </FormDescription>

            <FormField
                control={form.control}
                name="scheduled.dateStart"
                rules={{ required: "Select a start date" }}
                render={({ field }) => {
                    const { value, ...rest } = field;
                    return (
                        <FormItem>
                            <FormLabel>Start date</FormLabel>
                            <Popover>
                                <PopoverTrigger {...rest} asChild>
                                    <FormControl>
                                        <Button
                                            variant={"outline"}
                                            className={
                                                styles.datePicker__trigger
                                            }
                                        >
                                            <CalendarIcon size={20} />
                                            {field.value ? (
                                                format(field.value, "PPP")
                                            ) : (
                                                <span>Pick a date</span>
                                            )}
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={(value) => {
                                            if (!value) return;
                                            form.setValue(
                                                "scheduled.dateEnd",
                                                value
                                            );
                                            field.onChange(value);
                                        }}
                                        disabled={(date) =>
                                            isBefore(
                                                date,
                                                startOfDay(new Date())
                                            )
                                        }
                                        initialFocus
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
                    <div className={styles.formSchedule__endDate}>
                        <FormItem variant={"checkbox"}>
                            <Checkbox
                                onCheckedChange={setIsEndDate}
                                id={"is-end-date"}
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
                                            <Button
                                                variant={"outline"}
                                                className={
                                                    styles.datePicker__trigger
                                                }
                                            >
                                                <CalendarIcon size={20} />
                                                {field.value ? (
                                                    format(field.value, "PPP")
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            disabled={(date) =>
                                                isBefore(
                                                    date,
                                                    startOfDay(new Date())
                                                ) ||
                                                date <
                                                    form.getValues(
                                                        "scheduled.dateStart"
                                                    )
                                            }
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    </div>
                )}
            />
        </Panel>
    );
}
