import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Tiles } from "@frak-labs/design-system/components/Tiles";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { EditField } from "@/module/forms/EditField";
import { Form, FormControl, FormField } from "@/module/forms/Form";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { useCustomizeSection } from "../saveRegistry";
import { WordingLangTabs } from "./ComponentEditor";
import * as styles from "./customize.css";
import {
    applyBrand,
    formatSharingPreview,
    matchSharingPreset,
    SHARING_PRESETS,
} from "./presets";
import {
    sharingValuesToTranslations,
    translationsToSharingValues,
} from "./sharingTranslations";
import type { SharingWordingFormValues, WordingLang } from "./types";

/**
 * Editor for the copy the OS share sheet shows (`sharing.title` /
 * `sharing.text`). Separate from the component editor because these live in
 * `sdkConfig.translations`, a tiered key -> string dictionary, not in
 * `components`.
 */
export function SharingWordingPanel({
    merchantId,
    sdkConfig,
    shopName,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
    shopName: string;
}) {
    const { t } = useTranslation();
    const { mutateAsync: editSdkConfig, isSuccess } = useMerchantUpdate({
        merchantId,
        target: "sdk-config",
    });

    const [activeLang, setActiveLang] = useState<WordingLang>("default");

    const values = useMemo(
        () => translationsToSharingValues(sdkConfig.translations),
        [sdkConfig.translations]
    );

    const form = useForm<SharingWordingFormValues>({ values });

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    const onSubmit = useCallback(
        (v: SharingWordingFormValues) =>
            editSdkConfig({
                translations: sharingValuesToTranslations(
                    v,
                    sdkConfig.translations
                ),
            }),
        [editSdkConfig, sdkConfig.translations]
    );

    useCustomizeSection("default-sharing", form, onSubmit);

    return (
        <Form {...form}>
            <Card radius="m">
                <Stack space="m">
                    <Stack space="xxs">
                        <Text
                            variant="bodySmall"
                            weight="medium"
                            color="secondary"
                        >
                            {t("customize.sharing.title")}
                        </Text>
                        <Text variant="caption" color="tertiary">
                            {t("customize.sharing.description")}
                        </Text>
                    </Stack>

                    <SharingPresets form={form} shopName={shopName} />

                    <WordingLangTabs
                        selected={activeLang}
                        onSelect={setActiveLang}
                    />

                    <div className={styles.settingsGrid}>
                        <FormField
                            control={form.control}
                            name={`title.${activeLang}`}
                            render={({ field }) => (
                                <EditField>
                                    <FormControl>
                                        <Input
                                            variant="bare"
                                            tone="muted"
                                            maxLength={500}
                                            label={t(
                                                "customize.sharing.fields.title.label"
                                            )}
                                            hint={t(
                                                "customize.sharing.fields.title.hint"
                                            )}
                                            {...field}
                                        />
                                    </FormControl>
                                </EditField>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`text.${activeLang}`}
                            render={({ field }) => (
                                <EditField>
                                    <FormControl>
                                        <Input
                                            variant="bare"
                                            tone="muted"
                                            maxLength={500}
                                            label={t(
                                                "customize.sharing.fields.text.label"
                                            )}
                                            hint={t(
                                                "customize.sharing.fields.text.hint"
                                            )}
                                            {...field}
                                        />
                                    </FormControl>
                                </EditField>
                            )}
                        />
                    </div>
                </Stack>
            </Card>
        </Form>
    );
}

/**
 * Curated wording choices. Picking one writes en + fr for both slots and
 * clears the `default` tier, which would otherwise win the cascade and hide
 * the copy just chosen.
 */
function SharingPresets({
    form,
    shopName,
}: {
    form: UseFormReturn<SharingWordingFormValues>;
    shopName: string;
}) {
    const currentEn = String(form.watch("title.en") ?? "");
    const selected = matchSharingPreset(currentEn, shopName);

    return (
        <RadioGroup
            value={selected !== null ? String(selected) : ""}
            onValueChange={(value) => {
                const preset = SHARING_PRESETS[Number(value)];
                form.setValue("title.default", "", { shouldDirty: true });
                form.setValue("text.default", "", { shouldDirty: true });
                for (const lang of ["en", "fr"] as const) {
                    form.setValue(
                        `title.${lang}`,
                        applyBrand(preset[lang].title, shopName),
                        { shouldDirty: true }
                    );
                    form.setValue(
                        `text.${lang}`,
                        applyBrand(preset[lang].text, shopName),
                        { shouldDirty: true }
                    );
                }
            }}
        >
            <Tiles columns={{ mobile: 1, tablet: 2 }} space="m">
                {SHARING_PRESETS.map((preset, index) => (
                    <PresetRow key={preset.en.title} value={String(index)}>
                        <Stack space="none" as="span">
                            <Text variant="body" weight="medium" as="span">
                                {formatSharingPreview(
                                    preset.en.title,
                                    shopName
                                )}
                            </Text>
                            <Text
                                variant="bodySmall"
                                color="tertiary"
                                as="span"
                            >
                                {formatSharingPreview(preset.en.text, shopName)}
                            </Text>
                        </Stack>
                    </PresetRow>
                ))}
            </Tiles>
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
