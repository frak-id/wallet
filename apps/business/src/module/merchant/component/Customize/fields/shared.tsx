import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, CopyIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import type { FieldPath, UseFormReturn } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { useCopyToClipboardWithState } from "@/module/common/hook/useCopyToClipboardWithState";
import { EditField } from "@/module/forms/EditField";
import { FormControl, FormField } from "@/module/forms/Form";
import * as styles from "../customize.css";
import { CUSTOM_CSS_ENABLED } from "../flags";
import type { ComponentSettingsFormValues, WordingLang } from "../types";

export const REWARD_TOKEN = "{REWARD}";

/**
 * Inline hint shown atop the advanced wording fields: tells merchants they can
 * drop `{REWARD}` into any text to inject the live campaign reward, and lets
 * them copy the token with a click.
 */
export function RewardTokenHint() {
    const { t } = useTranslation();
    const { copied, copy } = useCopyToClipboardWithState();
    return (
        <div className={styles.rewardHint}>
            <Trans
                i18nKey="customize.components.rewardToken.hint"
                components={{
                    token: (
                        <button
                            type="button"
                            className={styles.rewardToken}
                            onClick={() => copy(REWARD_TOKEN)}
                            aria-label={t(
                                "customize.components.rewardToken.copy"
                            )}
                        >
                            {REWARD_TOKEN}
                            {copied ? (
                                <CheckIcon width={14} height={14} />
                            ) : (
                                <CopyIcon width={14} height={14} />
                            )}
                        </button>
                    ),
                }}
            />
        </div>
    );
}

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
