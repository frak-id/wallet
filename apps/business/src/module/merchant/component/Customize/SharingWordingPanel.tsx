import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import { RadioGroup } from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Tiles } from "@frak-labs/design-system/components/Tiles";
import { SocialPreview } from "@frak-labs/ui-preview";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { PreviewWrapper } from "@/module/common/component/PreviewWrapper";
import { EditField } from "@/module/forms/EditField";
import { Form, FormControl, FormField } from "@/module/forms/Form";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { useCustomizeSection } from "../saveRegistry";
import { WordingLangTabs } from "./ComponentEditor";
import * as styles from "./customize.css";
import { resolveBuiltInLang, resolvePreviewWording } from "./localizable";
import {
    applyBrand,
    BUNDLED_SHARING_DEFAULT,
    formatSharingPreview,
    matchSharingPreset,
    SHARING_PRESETS,
} from "./presets";
import { SECTION_KEYS } from "./sections";
import {
    sharingValuesToTranslations,
    translationsToSharingValues,
} from "./sharingTranslations";
import type { SharingWordingFormValues, WordingLang } from "./types";
import { PresetRow } from "./WordingPresets";

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

    useCustomizeSection(SECTION_KEYS.sharing, form, onSubmit);

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

                    <WordingLangTabs
                        selected={activeLang}
                        onSelect={setActiveLang}
                    />

                    <PreviewWrapper label={t("customize.sharing.preview")}>
                        <SharingPreview
                            form={form}
                            lang={activeLang}
                            sdkConfig={sdkConfig}
                            shopName={shopName}
                        />
                    </PreviewWrapper>

                    <SharingPresets form={form} shopName={shopName} />

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

/** Stand-in link while the merchant has set no homepage. */
const SAMPLE_SHARE_LINK = "https://example.com/product";

/**
 * The share message as a messaging app renders it. Tracks the form, so a
 * merchant reads their own copy while typing it.
 *
 * Falls back to the wallet's bundled copy: `wallet-shared` is off-limits to
 * this app, and an unconfigured merchant ships exactly that wording.
 */
function SharingPreview({
    form,
    lang,
    sdkConfig,
    shopName,
}: {
    form: UseFormReturn<SharingWordingFormValues>;
    lang: WordingLang;
    sdkConfig: SdkConfig;
    shopName: string;
}) {
    const values = form.watch();
    const fallback =
        BUNDLED_SHARING_DEFAULT[resolveBuiltInLang(lang, sdkConfig.lang)];

    return (
        <SocialPreview
            title={formatSharingPreview(
                resolvePreviewWording(values.title, lang, fallback.title),
                shopName
            )}
            text={formatSharingPreview(
                resolvePreviewWording(values.text, lang, fallback.text),
                shopName
            )}
            link={sdkConfig.homepageLink ?? SAMPLE_SHARE_LINK}
            imageUrl={sdkConfig.logoUrl ?? undefined}
        />
    );
}

/**
 * Curated wording choices. Picking one writes en + fr for both slots and
 * clears the `default` tier: the backend resolves `{ ...default, ...lang }`
 * (`MerchantResolveService.mergeTranslations`), so a leftover `default` only
 * surfaces for a language the preset did not write — leaving the merchant with
 * copy they did not choose.
 */
function SharingPresets({
    form,
    shopName,
}: {
    form: UseFormReturn<SharingWordingFormValues>;
    shopName: string;
}) {
    const currentTitle = String(form.watch("title.en") ?? "");
    const currentText = String(form.watch("text.en") ?? "");
    const selected = matchSharingPreset(currentTitle, currentText, shopName);

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
