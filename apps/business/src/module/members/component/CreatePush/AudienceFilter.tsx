import { Checkbox } from "@frak-labs/design-system/components/Checkbox";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { type Control, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DateField as DateInput } from "@/module/common/component/DateField";
import { EditField } from "@/module/forms/EditField";
import { Form, FormControl, FormField } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering";
import * as styles from "./push-create.css";

/** The audience date filter stores unix seconds; DateField speaks ISO strings. */
const secondsToIso = (seconds?: number) =>
    seconds ? new Date(seconds * 1000).toISOString() : undefined;

const isoToSeconds = (iso: string | undefined) =>
    iso ? Math.floor(new Date(iso).getTime() / 1000) : undefined;

type Range = { min?: number; max?: number } | undefined;

const hasRange = (range: Range) =>
    range !== undefined && (range.min !== undefined || range.max !== undefined);

/**
 * Audience segment editor — Membership Date + Interactions ranges, each
 * gated by a checkbox. Produces a `FormMembersFiltering` value.
 */
export function AudienceFilter({
    initialValue,
    onFilterSet,
}: {
    initialValue?: FormMembersFiltering;
    onFilterSet: (filter: FormMembersFiltering) => void;
}) {
    const { t } = useTranslation();
    // Seed once — echoing the parent's committed value back through `values`
    // would reset an enabled-but-empty range to undefined, unchecking the box.
    const form = useForm<FormMembersFiltering>({
        defaultValues: initialValue ?? {},
    });
    const { control, getValues, setValue } = form;

    const dateEnabled =
        useWatch({ control, name: "firstInteractionTimestamp" }) !== undefined;
    const interactionsEnabled =
        useWatch({ control, name: "interactions" }) !== undefined;

    const commit = () => {
        const data = getValues();
        onFilterSet({
            merchantIds: initialValue?.merchantIds,
            firstInteractionTimestamp: hasRange(data.firstInteractionTimestamp)
                ? data.firstInteractionTimestamp
                : undefined,
            interactions: hasRange(data.interactions)
                ? data.interactions
                : undefined,
        });
    };

    return (
        <Form {...form}>
            <Stack space="m">
                <div className={styles.audienceSection}>
                    <CheckboxCell
                        label={t("members.filters.membershipDate")}
                        checked={dateEnabled}
                        onCheckedChange={(checked) => {
                            setValue(
                                "firstInteractionTimestamp",
                                checked ? {} : undefined
                            );
                            commit();
                        }}
                    />
                    <div className={styles.dateRow}>
                        <DateField
                            control={control}
                            name="firstInteractionTimestamp.min"
                            label={t("members.filters.from")}
                            disabled={!dateEnabled}
                            onCommit={commit}
                        />
                        <DateField
                            control={control}
                            name="firstInteractionTimestamp.max"
                            label={t("members.filters.to")}
                            disabled={!dateEnabled}
                            onCommit={commit}
                        />
                    </div>
                </div>

                <div className={styles.audienceSection}>
                    <CheckboxCell
                        label={t("members.filters.interactions")}
                        checked={interactionsEnabled}
                        onCheckedChange={(checked) => {
                            setValue("interactions", checked ? {} : undefined);
                            commit();
                        }}
                    />
                    <div className={styles.dateRow}>
                        <NumberField
                            control={control}
                            name="interactions.min"
                            label={t("members.filters.from")}
                            placeholder={t("members.filters.minInteractions")}
                            disabled={!interactionsEnabled}
                            onCommit={commit}
                        />
                        <NumberField
                            control={control}
                            name="interactions.max"
                            label={t("members.filters.to")}
                            placeholder={t("members.filters.maxInteractions")}
                            disabled={!interactionsEnabled}
                            onCommit={commit}
                        />
                    </div>
                </div>
            </Stack>
        </Form>
    );
}

function CheckboxCell({
    label,
    checked,
    onCheckedChange,
}: {
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        // biome-ignore lint/a11y/noLabelWithoutControl: wraps the Checkbox
        <label className={styles.audienceCell}>
            <Checkbox
                size="l"
                checked={checked}
                onCheckedChange={(value) => onCheckedChange(value === true)}
            />
            <Text variant="body" weight="medium">
                {label}
            </Text>
        </label>
    );
}

function DateField({
    control,
    name,
    label,
    disabled,
    onCommit,
}: {
    control: Control<FormMembersFiltering>;
    name: "firstInteractionTimestamp.min" | "firstInteractionTimestamp.max";
    label: string;
    disabled?: boolean;
    onCommit: () => void;
}) {
    return (
        <div className={styles.dateField}>
            <FormField
                control={control}
                name={name}
                render={({ field }) => (
                    <EditField label={label}>
                        <DateInput
                            value={secondsToIso(field.value)}
                            onChange={(iso) => {
                                field.onChange(isoToSeconds(iso));
                                onCommit();
                            }}
                            ariaLabel={label}
                            disabled={disabled}
                        />
                    </EditField>
                )}
            />
        </div>
    );
}

function NumberField({
    control,
    name,
    label,
    placeholder,
    disabled,
    onCommit,
}: {
    control: Control<FormMembersFiltering>;
    name: "interactions.min" | "interactions.max";
    label: string;
    placeholder: string;
    disabled?: boolean;
    onCommit: () => void;
}) {
    return (
        <div className={styles.dateField}>
            <FormField
                control={control}
                name={name}
                render={({ field }) => (
                    <EditField label={label}>
                        <FormControl>
                            <Input
                                variant="bare"
                                tone="muted"
                                type="number"
                                min={0}
                                disabled={disabled}
                                placeholder={placeholder}
                                value={field.value ?? ""}
                                onChange={(event) =>
                                    field.onChange(
                                        event.target.value === ""
                                            ? undefined
                                            : Number(event.target.value)
                                    )
                                }
                                onBlur={() => {
                                    field.onBlur();
                                    onCommit();
                                }}
                            />
                        </FormControl>
                    </EditField>
                )}
            />
        </div>
    );
}
