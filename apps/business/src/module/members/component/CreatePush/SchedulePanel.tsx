import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { TimeInput } from "@frak-labs/design-system/components/TimeInput";
import { startOfDay } from "date-fns";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DateField as DateInput } from "@/module/common/component/DateField";
import { EditCard } from "@/module/common/component/EditCard";
import { EditField } from "@/module/forms/EditField";
import { FormControl, FormField } from "@/module/forms/Form";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";
import * as styles from "./push-create.css";

/**
 * Schedule — send immediately or pick a delivery date + time.
 */
export function SchedulePanel() {
    const { t } = useTranslation();
    const { control, watch, getValues } =
        useFormContext<FormCreatePushNotification>();
    const scheduleType = watch("schedule.type");

    const requireWhenLater = (value: string) =>
        getValues("schedule.type") !== "later" ||
        !!value ||
        t("push.create.schedule.required");

    return (
        <EditCard
            title={t("push.create.schedule.title")}
            description={t("push.create.schedule.description")}
        >
            <Controller
                control={control}
                name={"schedule.type"}
                rules={{
                    validate: (value) =>
                        value === "now" ||
                        value === "later" ||
                        t("push.create.schedule.required"),
                }}
                render={({ field }) => (
                    <RadioGroup
                        className={styles.scheduleGrid}
                        value={field.value}
                        onValueChange={field.onChange}
                    >
                        <ScheduleOption
                            value={"now"}
                            label={t("push.create.schedule.now.label")}
                            description={t(
                                "push.create.schedule.now.description"
                            )}
                        />
                        <ScheduleOption
                            value={"later"}
                            label={t("push.create.schedule.later.label")}
                            description={t(
                                "push.create.schedule.later.description"
                            )}
                        />
                    </RadioGroup>
                )}
            />
            {scheduleType === "later" && (
                <div className={styles.dateRow}>
                    <div className={styles.dateField}>
                        <FormField
                            control={control}
                            name={"schedule.date"}
                            rules={{ validate: requireWhenLater }}
                            render={({ field, fieldState }) => (
                                <EditField
                                    label={t("push.create.schedule.date.label")}
                                >
                                    <DateInput
                                        value={field.value || undefined}
                                        onChange={(iso) =>
                                            field.onChange(iso ?? "")
                                        }
                                        ariaLabel={t(
                                            "push.create.schedule.date.label"
                                        )}
                                        minDate={startOfDay(new Date())}
                                        error={Boolean(fieldState.error)}
                                    />
                                </EditField>
                            )}
                        />
                    </div>
                    <div className={styles.dateField}>
                        <FormField
                            control={control}
                            name={"schedule.time"}
                            rules={{ validate: requireWhenLater }}
                            render={({ field }) => (
                                <EditField
                                    label={t("push.create.schedule.time.label")}
                                >
                                    <FormControl>
                                        <TimeInput
                                            variant={"bare"}
                                            tone={"muted"}
                                            {...field}
                                        />
                                    </FormControl>
                                </EditField>
                            )}
                        />
                    </div>
                </div>
            )}
        </EditCard>
    );
}

function ScheduleOption({
    value,
    label,
    description,
}: {
    value: string;
    label: string;
    description: string;
}) {
    return (
        // biome-ignore lint/a11y/noLabelWithoutControl: wraps a labelable Radix radio button
        <label className={styles.scheduleCell}>
            <RadioGroupItem value={value} size={"l"} />
            <Stack space={"xxs"}>
                <Text variant={"body"} weight={"medium"}>
                    {label}
                </Text>
                <Text variant={"bodySmall"} color={"secondary"}>
                    {description}
                </Text>
            </Stack>
        </label>
    );
}
