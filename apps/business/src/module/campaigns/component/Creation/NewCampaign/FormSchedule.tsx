import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Checkbox } from "@frak-labs/design-system/components/Checkbox";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import { format, isBefore, startOfDay } from "date-fns";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { ButtonCalendar } from "@/module/common/component/ButtonCalendar";
import { Calendar } from "@/module/common/component/Calendar";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import * as styles from "./form-schedule.css";

/** Minimal shape this form binds to; the host maps it to `rule`/`expiresAt`. */
type ScheduleFormValues = {
    scheduled: { startDate?: string; endDate?: string };
};

export function FormSchedule() {
    const { control, watch, setValue, getValues } =
        useFormContext<ScheduleFormValues>();
    const [hasEndDate, setHasEndDate] = useState(false);

    const watchEndDate = watch("scheduled.endDate");

    useEffect(() => {
        setHasEndDate(!!watchEndDate);
    }, [watchEndDate]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Schedule</CardTitle>
            </CardHeader>
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
                                            format(new Date(field.value), "PPP")
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
                                    selected={
                                        field.value
                                            ? new Date(field.value)
                                            : undefined
                                    }
                                    onSelect={(date) => {
                                        field.onChange(date?.toISOString());
                                        if (hasEndDate && date) {
                                            const endDate =
                                                getValues("scheduled.endDate");
                                            if (
                                                endDate &&
                                                date > new Date(endDate)
                                            ) {
                                                setValue(
                                                    "scheduled.endDate",
                                                    date.toISOString()
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
                            className={styles.formScheduleEndDate}
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
                                                    format(
                                                        new Date(field.value),
                                                        "PPP"
                                                    )
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                            </ButtonCalendar>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent align="start">
                                        <Calendar
                                            mode="single"
                                            selected={
                                                field.value
                                                    ? new Date(field.value)
                                                    : undefined
                                            }
                                            onSelect={(date) =>
                                                field.onChange(
                                                    date?.toISOString()
                                                )
                                            }
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
                                                getValues("scheduled.startDate")
                                                    ? new Date(
                                                          getValues(
                                                              "scheduled.startDate"
                                                          ) as string
                                                      )
                                                    : new Date()
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
        </Card>
    );
}
