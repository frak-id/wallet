import type { Currency } from "@frak-labs/core-sdk";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useId } from "react";
import type { FieldPath, UseFormReturn } from "react-hook-form";
import * as styles from "./customize.css";
import {
    applyBrand,
    BANNER_PRESETS,
    BUTTON_SHARE_PRESETS,
    formatPresetLabel,
    matchBannerPreset,
    matchButtonSharePreset,
    matchPostPurchasePreset,
    POST_PURCHASE_PRESETS,
} from "./presets";
import type { ComponentSettingsFormValues, ComponentType } from "./types";

/**
 * 2×2 grid of curated wording choices for the selected component. The radio
 * reflects the current stored text (none selected for custom wording) and
 * picking one writes the preset's en + fr copy into the form, updating the
 * live preview.
 */
export function WordingPresets({
    componentType,
    form,
    currency,
    shopName,
}: {
    componentType: ComponentType;
    form: UseFormReturn<ComponentSettingsFormValues>;
    currency: Currency;
    shopName: string;
}) {
    if (componentType === "banner") {
        return (
            <BannerPresets
                form={form}
                currency={currency}
                shopName={shopName}
            />
        );
    }
    if (componentType === "postPurchase") {
        return <PostPurchasePresets form={form} currency={currency} />;
    }
    return <ButtonSharePresets form={form} currency={currency} />;
}

function ButtonSharePresets({
    form,
    currency,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    currency: Currency;
}) {
    const defaultField =
        "buttonShare.text.default" as FieldPath<ComponentSettingsFormValues>;
    const enField =
        "buttonShare.text.en" as FieldPath<ComponentSettingsFormValues>;
    const frField =
        "buttonShare.text.fr" as FieldPath<ComponentSettingsFormValues>;

    const currentEn = String(form.watch(enField) ?? "");
    const selected = matchButtonSharePreset(currentEn);

    return (
        <RadioGroup
            className={styles.presetGrid}
            value={selected !== null ? String(selected) : ""}
            onValueChange={(value) => {
                const preset = BUTTON_SHARE_PRESETS[Number(value)];
                // Clear the language-agnostic `default` tier so the en/fr
                // preset copy actually surfaces (default wins in the cascade).
                form.setValue(defaultField, "", { shouldDirty: true });
                form.setValue(enField, preset.en, { shouldDirty: true });
                form.setValue(frField, preset.fr, { shouldDirty: true });
            }}
        >
            {BUTTON_SHARE_PRESETS.map((preset, index) => (
                <PresetRow key={preset.en} value={String(index)}>
                    <Text variant="body" weight="medium" as="span">
                        {formatPresetLabel(preset.en, currency)}
                    </Text>
                </PresetRow>
            ))}
        </RadioGroup>
    );
}

function PostPurchasePresets({
    form,
    currency,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    currency: Currency;
}) {
    const refereeDefaultField =
        "postPurchase.refereeText.default" as FieldPath<ComponentSettingsFormValues>;
    const refereeEnField =
        "postPurchase.refereeText.en" as FieldPath<ComponentSettingsFormValues>;
    const refereeFrField =
        "postPurchase.refereeText.fr" as FieldPath<ComponentSettingsFormValues>;
    const referrerDefaultField =
        "postPurchase.referrerText.default" as FieldPath<ComponentSettingsFormValues>;
    const referrerEnField =
        "postPurchase.referrerText.en" as FieldPath<ComponentSettingsFormValues>;
    const referrerFrField =
        "postPurchase.referrerText.fr" as FieldPath<ComponentSettingsFormValues>;

    const currentRefereeEn = String(form.watch(refereeEnField) ?? "");
    const selected = matchPostPurchasePreset(currentRefereeEn);

    return (
        <RadioGroup
            className={styles.presetGrid}
            value={selected !== null ? String(selected) : ""}
            onValueChange={(value) => {
                const preset = POST_PURCHASE_PRESETS[Number(value)];
                // Clear the `default` tiers so the en/fr preset copy surfaces.
                form.setValue(refereeDefaultField, "", { shouldDirty: true });
                form.setValue(referrerDefaultField, "", { shouldDirty: true });
                form.setValue(refereeEnField, preset.referee.en, {
                    shouldDirty: true,
                });
                form.setValue(refereeFrField, preset.referee.fr, {
                    shouldDirty: true,
                });
                form.setValue(referrerEnField, preset.referrer.en, {
                    shouldDirty: true,
                });
                form.setValue(referrerFrField, preset.referrer.fr, {
                    shouldDirty: true,
                });
            }}
        >
            {POST_PURCHASE_PRESETS.map((preset, index) => (
                <PresetRow key={preset.referee.en} value={String(index)}>
                    <Stack space="none" as="span">
                        <Text variant="body" weight="medium" as="span">
                            {formatPresetLabel(preset.referee.en, currency)}
                        </Text>
                        <Text variant="bodySmall" color="tertiary" as="span">
                            {formatPresetLabel(preset.referrer.en, currency)}
                        </Text>
                    </Stack>
                </PresetRow>
            ))}
        </RadioGroup>
    );
}

function BannerPresets({
    form,
    currency,
    shopName,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    currency: Currency;
    shopName: string;
}) {
    const titleDefaultField =
        "banner.referralTitle.default" as FieldPath<ComponentSettingsFormValues>;
    const titleEnField =
        "banner.referralTitle.en" as FieldPath<ComponentSettingsFormValues>;
    const titleFrField =
        "banner.referralTitle.fr" as FieldPath<ComponentSettingsFormValues>;
    const descDefaultField =
        "banner.referralDescription.default" as FieldPath<ComponentSettingsFormValues>;
    const descEnField =
        "banner.referralDescription.en" as FieldPath<ComponentSettingsFormValues>;
    const descFrField =
        "banner.referralDescription.fr" as FieldPath<ComponentSettingsFormValues>;

    const titleEn = String(form.watch(titleEnField) ?? "");
    const descEn = String(form.watch(descEnField) ?? "");
    const selected = matchBannerPreset(titleEn, descEn, shopName);

    return (
        <RadioGroup
            className={styles.presetGrid}
            value={selected !== null ? String(selected) : ""}
            onValueChange={(value) => {
                const preset = BANNER_PRESETS[Number(value)];
                // Clear the `default` tiers so the en/fr preset copy surfaces.
                form.setValue(titleDefaultField, "", { shouldDirty: true });
                form.setValue(descDefaultField, "", { shouldDirty: true });
                form.setValue(
                    titleEnField,
                    applyBrand(preset.en.title, shopName),
                    { shouldDirty: true }
                );
                form.setValue(
                    titleFrField,
                    applyBrand(preset.fr.title, shopName),
                    { shouldDirty: true }
                );
                form.setValue(
                    descEnField,
                    applyBrand(preset.en.description, shopName),
                    { shouldDirty: true }
                );
                form.setValue(
                    descFrField,
                    applyBrand(preset.fr.description, shopName),
                    { shouldDirty: true }
                );
            }}
        >
            {BANNER_PRESETS.map((preset, index) => (
                <PresetRow key={preset.en.title} value={String(index)}>
                    <Stack space="none" as="span">
                        <Text variant="body" weight="medium" as="span">
                            {formatPresetLabel(preset.en.title, currency)}
                        </Text>
                        <Text variant="bodySmall" color="tertiary" as="span">
                            {formatPresetLabel(
                                applyBrand(preset.en.description, shopName),
                                currency
                            )}
                        </Text>
                    </Stack>
                </PresetRow>
            ))}
        </RadioGroup>
    );
}

function PresetRow({
    value,
    children,
}: {
    value: string;
    children: React.ReactNode;
}) {
    const id = useId();
    return (
        <div className={styles.presetRow}>
            <RadioGroupItem id={id} value={value} size="l" />
            <label htmlFor={id} className={styles.radioRowLabel}>
                {children}
            </label>
        </div>
    );
}
