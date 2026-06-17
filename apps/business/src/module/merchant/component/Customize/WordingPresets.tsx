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
 * Presets are bilingual and language-independent in the UI: one picker (not
 * tied to the active language tab) writes both `en` + `fr` at once. Kept hidden
 * behind this flag until the feature is wired up end to end.
 */
const WORDING_PRESETS_ENABLED = false;

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
    if (!WORDING_PRESETS_ENABLED) return null;
    if (componentType === "banner") {
        return (
            <BannerPresets
                form={form}
                currency={currency}
                shopName={shopName}
            />
        );
    }
    return (
        <TextPresets
            componentType={componentType}
            form={form}
            currency={currency}
        />
    );
}

function TextPresets({
    componentType,
    form,
    currency,
}: {
    componentType: "buttonShare" | "postPurchase";
    form: UseFormReturn<ComponentSettingsFormValues>;
    currency: Currency;
}) {
    const isButtonShare = componentType === "buttonShare";
    const presets = isButtonShare
        ? BUTTON_SHARE_PRESETS
        : POST_PURCHASE_PRESETS;
    const enField = (
        isButtonShare ? "buttonShare.text.en" : "postPurchase.refereeText.en"
    ) as FieldPath<ComponentSettingsFormValues>;
    const frField = (
        isButtonShare ? "buttonShare.text.fr" : "postPurchase.refereeText.fr"
    ) as FieldPath<ComponentSettingsFormValues>;

    const currentEn = String(form.watch(enField) ?? "");
    const selected = isButtonShare
        ? matchButtonSharePreset(currentEn)
        : matchPostPurchasePreset(currentEn);

    return (
        <RadioGroup
            className={styles.presetGrid}
            value={selected !== null ? String(selected) : ""}
            onValueChange={(value) => {
                const preset = presets[Number(value)];
                form.setValue(enField, preset.en, { shouldDirty: true });
                form.setValue(frField, preset.fr, { shouldDirty: true });
            }}
        >
            {presets.map((preset, index) => (
                <PresetRow key={preset.en} value={String(index)}>
                    <Text variant="body" weight="medium" as="span">
                        {formatPresetLabel(preset.en, currency)}
                    </Text>
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
    const titleEnField =
        "banner.referralTitle.en" as FieldPath<ComponentSettingsFormValues>;
    const titleFrField =
        "banner.referralTitle.fr" as FieldPath<ComponentSettingsFormValues>;
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
