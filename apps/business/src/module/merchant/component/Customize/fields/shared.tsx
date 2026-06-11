import { Input } from "@frak-labs/design-system/components/Input";
import type { FieldPath, UseFormReturn } from "react-hook-form";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import * as styles from "../customize.css";
import type { ComponentSettingsFormValues } from "../types";

/** String-valued form paths editable as plain text. */
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

export function WordingTextField({
    form,
    name,
    label,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    name: WordingFieldName;
    label: string;
}) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem className={styles.fieldItem}>
                    <FormLabel className={styles.fieldLabel}>{label}</FormLabel>
                    <FormControl>
                        <Input variant="bare" tone="muted" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
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
                <FormItem className={styles.fieldItem}>
                    <FormLabel className={styles.fieldLabel}>{label}</FormLabel>
                    <FormControl>
                        <textarea
                            className={styles.cssTextarea}
                            placeholder={placeholder}
                            rows={4}
                            {...field}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
