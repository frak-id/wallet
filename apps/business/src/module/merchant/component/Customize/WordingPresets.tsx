import type { Currency } from "@frak-labs/core-sdk";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useId } from "react";
import type { UseFormReturn } from "react-hook-form";
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
 * picking one writes the preset into the form, updating the live preview.
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
    const fieldName = isButtonShare
        ? ("buttonShare.text" as const)
        : ("postPurchase.refereeText" as const);

    const current = form.watch(fieldName);
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
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    currency: Currency;
    shopName: string;
}) {
    const title = form.watch("banner.referralTitle");
    const description = form.watch("banner.referralDescription");
    const selected = matchBannerPreset(title, description, shopName);

    return (
        <RadioGroup
            className={styles.presetGrid}
            value={selected !== null ? String(selected) : ""}
            onValueChange={(value) => {
                const preset = BANNER_PRESETS[Number(value)];
                form.setValue(
                    "banner.referralTitle",
                    applyBrand(preset.title, shopName),
                    { shouldDirty: true }
                );
                form.setValue(
                    "banner.referralDescription",
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
