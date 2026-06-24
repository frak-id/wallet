import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import type { FieldPath, UseFormReturn } from "react-hook-form";
import { EditField } from "@/module/forms/EditField";
import { FormControl, FormField } from "@/module/forms/Form";
import * as styles from "../customize.css";
import { CUSTOM_CSS_ENABLED } from "../flags";
import type { ComponentSettingsFormValues, WordingLang } from "../types";

/** Titled group of wording inputs, used to split the advanced fields by audience. */
export function FieldGroup({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <Stack space="s">
            <Text variant="bodySmall" weight="medium" color="secondary">
                {title}
            </Text>
            <div className={styles.settingsGrid}>{children}</div>
        </Stack>
    );
}

/** Localizable form paths (each resolves to a `LocalizedText`). */
export type WordingFieldName = Extract<
    FieldPath<ComponentSettingsFormValues>,
    | `buttonShare.${"text" | "noRewardText"}`
    | `postPurchase.${
          | "badgeText"
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
    if (!CUSTOM_CSS_ENABLED) return null;
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
