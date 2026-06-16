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
import type {
    ComponentSettingsFormValues,
    ComponentType,
    WordingLang,
} from "./types";

/**
 * Presets write fixed English texts into the merchant component config;
 * keep them hidden until the SDK supports localized wording.
 */
const WORDING_PRESETS_ENABLED = false;

/**
 * 2×2 grid of curated wording choices for the selected component. The radio
 * reflects the current stored text (none selected for custom wording) and
 * picking one writes the preset into the form, updating the live preview.
 */
export function WordingPresets({
    componentType,
    form,
    currency,
    shopName,
    lang,
}: {
    componentType: ComponentType;
    form: UseFormReturn<ComponentSettingsFormValues>;
    currency: Currency;
    shopName: string;
    lang: WordingLang;
}) {
    if (!WORDING_PRESETS_ENABLED) return null;
    if (componentType === "banner") {
        return (
            <BannerPresets
                form={form}
                currency={currency}
                shopName={shopName}
                lang={lang}
            />
        );
    }
    return (
        <TextPresets
            componentType={componentType}
            form={form}
            currency={currency}
            lang={lang}
        />
    );
}

function TextPresets({
    componentType,
    form,
    currency,
    lang,
}: {
    componentType: "buttonShare" | "postPurchase";
    form: UseFormReturn<ComponentSettingsFormValues>;
    currency: Currency;
    lang: WordingLang;
}) {
    const isButtonShare = componentType === "buttonShare";
    const presets = isButtonShare
        ? BUTTON_SHARE_PRESETS
        : POST_PURCHASE_PRESETS;
    const fieldName = (
        isButtonShare
            ? `buttonShare.text.${lang}`
            : `postPurchase.refereeText.${lang}`
    ) as FieldPath<ComponentSettingsFormValues>;

    const current = String(form.watch(fieldName) ?? "");
    const selected = isButtonShare
        ? matchButtonSharePreset(current)
        : matchPostPurchasePreset(current);

    return (
        <RadioGroup
            className={styles.presetGrid}
            value={selected !== null ? String(selected) : ""}
            onValueChange={(value) =>
                form.setValue(fieldName, presets[Number(value)], {
                    shouldDirty: true,
                })
            }
        >
            {presets.map((preset, index) => (
                <PresetRow key={preset} value={String(index)}>
                    <Text variant="body" weight="medium" as="span">
                        {formatPresetLabel(preset, currency)}
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
    lang,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    currency: Currency;
    shopName: string;
    lang: WordingLang;
}) {
    const titleField =
        `banner.referralTitle.${lang}` as FieldPath<ComponentSettingsFormValues>;
    const descriptionField =
        `banner.referralDescription.${lang}` as FieldPath<ComponentSettingsFormValues>;
    const title = String(form.watch(titleField) ?? "");
    const description = String(form.watch(descriptionField) ?? "");
    const selected = matchBannerPreset(title, description, shopName);

    return (
        <RadioGroup
            className={styles.presetGrid}
            value={selected !== null ? String(selected) : ""}
            onValueChange={(value) => {
                const preset = BANNER_PRESETS[Number(value)];
                form.setValue(titleField, applyBrand(preset.title, shopName), {
                    shouldDirty: true,
                });
                form.setValue(
                    descriptionField,
                    applyBrand(preset.description, shopName),
                    { shouldDirty: true }
                );
            }}
        >
            {BANNER_PRESETS.map((preset, index) => (
                <PresetRow key={preset.title} value={String(index)}>
                    <Stack space="none" as="span">
                        <Text variant="body" weight="medium" as="span">
                            {formatPresetLabel(preset.title, currency)}
                        </Text>
                        <Text variant="bodySmall" color="tertiary" as="span">
                            {formatPresetLabel(
                                applyBrand(preset.description, shopName),
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
