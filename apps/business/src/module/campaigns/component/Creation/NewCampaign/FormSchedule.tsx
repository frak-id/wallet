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
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();
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
                <CardTitle>{t("campaigns.creation.schedule.title")}</CardTitle>
            </CardHeader>
            <FormDescription>
                {t("campaigns.creation.schedule.description")}
            </FormDescription>

            <FormField
                control={control}
                name="scheduled.startDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            {t("campaigns.creation.schedule.startDateLabel")}
                        </FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <ButtonCalendar>
                                        {field.value ? (
                                            format(new Date(field.value), "PPP")
                                        ) : (
                                            <span>
                                                {t(
                                                    "campaigns.creation.schedule.startImmediately"
                                                )}
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
                                {t("campaigns.creation.schedule.setEndDate")}
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
                                                    <span>
                                                        {t(
                                                            "campaigns.creation.schedule.pickDate"
                                                        )}
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
