import { Input } from "@frak-labs/design-system/components/Input";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { EditField } from "@/module/forms/EditField";
import { FormControl, FormField } from "@/module/forms/Form";
import { TX_HASH_PATTERN } from "../validation";

/**
 * The three `FormField` blocks byte-identical across AddDepositSheet /
 * AddWithdrawSheet (billing-feature-fixes.md B6). Generic over the form's
 * value type via `Control<T>` + `FieldPath<T>` (react-hook-form's own
 * generics) so each sheet keeps its own strongly-typed field names — no
 * `as any`/`as unknown` cast needed at the call sites.
 */

type DocumentDateFieldProps<TFieldValues extends FieldValues> = {
    control: Control<TFieldValues>;
    name: FieldPath<TFieldValues>;
};

export function DocumentDateField<TFieldValues extends FieldValues>({
    control,
    name,
}: DocumentDateFieldProps<TFieldValues>) {
    const { t } = useTranslation();
    return (
        <FormField
            control={control}
            name={name}
            rules={{
                required: t("settings.billing.validation.required"),
            }}
            render={({ field }) => (
                <EditField
                    label={t(
                        "settings.billing.admin.fields.documentDate.label"
                    )}
                >
                    <FormControl>
                        <Input
                            type="date"
                            variant="bare"
                            tone="muted"
                            length="big"
                            {...field}
                        />
                    </FormControl>
                </EditField>
            )}
        />
    );
}

type TxHashFieldProps<TFieldValues extends FieldValues> = {
    control: Control<TFieldValues>;
    name: FieldPath<TFieldValues>;
};

export function TxHashField<TFieldValues extends FieldValues>({
    control,
    name,
}: TxHashFieldProps<TFieldValues>) {
    const { t } = useTranslation();
    return (
        <FormField
            control={control}
            name={name}
            rules={{
                pattern: {
                    value: TX_HASH_PATTERN,
                    message: t("settings.billing.validation.txHash"),
                },
            }}
            render={({ field }) => (
                <EditField
                    label={t("settings.billing.admin.fields.txHash.label")}
                >
                    <FormControl>
                        <Input
                            variant="bare"
                            tone="muted"
                            length="big"
                            placeholder="0x…"
                            {...field}
                        />
                    </FormControl>
                </EditField>
            )}
        />
    );
}

type NoteFieldProps<TFieldValues extends FieldValues> = {
    control: Control<TFieldValues>;
    name: FieldPath<TFieldValues>;
};

export function NoteField<TFieldValues extends FieldValues>({
    control,
    name,
}: NoteFieldProps<TFieldValues>) {
    const { t } = useTranslation();
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <EditField
                    label={t("settings.billing.admin.fields.note.label")}
                >
                    <FormControl>
                        <Input
                            variant="bare"
                            tone="muted"
                            length="big"
                            placeholder={t(
                                "settings.billing.admin.fields.note.placeholder"
                            )}
                            {...field}
                        />
                    </FormControl>
                </EditField>
            )}
        />
    );
}
