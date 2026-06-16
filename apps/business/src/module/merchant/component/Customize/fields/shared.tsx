import { Input } from "@frak-labs/design-system/components/Input";
import type { FieldPath, UseFormReturn } from "react-hook-form";
import { EditField } from "@/module/forms/EditField";
import { FormControl, FormField } from "@/module/forms/Form";
import * as styles from "../customize.css";
import type { ComponentSettingsFormValues, WordingLang } from "../types";

/** Localizable form paths (each resolves to a `LocalizedText`). */
export type WordingFieldName = Extract<
    FieldPath<ComponentSettingsFormValues>,
    | `buttonShare.${"text" | "noRewardText"}`
    | `postPurchase.${
          | "refereeText"
          | "refereeNoRewardText"
          | "referrerText"
          | "referrerNoRewardText"
          | "ctaText"
          | "ctaNoRewardText"}`
    | `banner.${
          | "referralTitle"
          | "referralDescription"
          | "referralCta"
          | "inappTitle"
          | "inappDescription"
          | "inappCta"}`
>;

/** Per-language leaf path, e.g. `banner.referralCta.fr` — resolves to a string. */
type WordingLeafName = Extract<
    FieldPath<ComponentSettingsFormValues>,
    `${WordingFieldName}.${WordingLang}`
>;

export function WordingTextField({
    form,
    name,
    label,
    lang,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    name: WordingFieldName;
    label: string;
    lang: WordingLang;
}) {
    const fieldName: WordingLeafName = `${name}.${lang}`;
    return (
        <FormField
            control={form.control}
            name={fieldName}
            render={({ field }) => (
                <EditField label={label}>
                    <FormControl>
                        <Input variant="bare" tone="muted" {...field} />
                    </FormControl>
                </EditField>
            )}
        />
    );
}

export function ComponentCssField({
    form,
    name,
    label,
    placeholder,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    name: `${"buttonShare" | "postPurchase" | "banner"}.css`;
    label: string;
    placeholder: string;
}) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <EditField label={label}>
                    <FormControl>
                        <textarea
                            className={styles.cssTextarea}
                            placeholder={placeholder}
                            rows={4}
                            {...field}
                        />
                    </FormControl>
                </EditField>
            )}
        />
    );
}
