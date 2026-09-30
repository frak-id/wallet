import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { componentDefaults } from "@frak-labs/components/i18n/defaults";
import type { Language } from "@frak-labs/core-sdk";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import { RadioGroup } from "@frak-labs/design-system/components/RadioGroup";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { TextArea } from "@frak-labs/design-system/components/TextArea";
import { Tiles } from "@frak-labs/design-system/components/Tiles";
import {
    AmbassadorHeroPreview,
    type AmbassadorPhoneFocus,
    AmbassadorPhonePreview,
    type AmbassadorPhoneTexts,
} from "@frak-labs/ui-preview";
import {
    type ChangeEvent,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FloatingPhonePreview } from "@/module/common/component/FloatingPhonePreview";
import { PreviewWrapper } from "@/module/common/component/PreviewWrapper";
import { EditField } from "@/module/forms/EditField";
import { Form, FormControl, FormField } from "@/module/forms/Form";
import { textareaMuted } from "@/module/merchant/component/Explorer/explorer.css";
import { ImageUploadField } from "@/module/merchant/component/ImageUploadField";
import { useCustomizeSection } from "../saveRegistry";
import {
    AMBASSADOR_FIELD_GROUPS,
    type AmbassadorCopy,
    type AmbassadorFormValues,
    type AmbassadorPhotoMode,
    type AmbassadorTextField,
    ambassadorToFormValues,
    builtInText,
    formValuesToAmbassador,
} from "./ambassadorForm";
import { WordingLangTabs } from "./ComponentEditor";
import * as customizeStyles from "./customize.css";
import { AdvancedDisclosure } from "./Disclosure";
import { FieldGroup } from "./fields/shared";
import { resolveBuiltInLang } from "./localizable";
import {
    AMBASSADOR_TONE_PRESET_FIELDS,
    AMBASSADOR_TONE_PRESETS,
    matchAmbassadorTonePreset,
} from "./presets";
import { SegmentedTabs } from "./SegmentedTabs";
import { SECTION_KEYS } from "./sections";
import type { LocalizedText, WordingLang } from "./types";
import { useSaveComponents } from "./useSaveComponents";
import { PresetRow } from "./WordingPresets";

const PHOTO_MODES = ["default", "custom", "none"] as const;

// Module-level so the watch subscription stays stable across renders.
const TONE_PRESET_PATHS = AMBASSADOR_TONE_PRESET_FIELDS.map(
    (field) => `texts.${field}` as const
);

const AMBASSADOR_GROUPS = Object.keys(AMBASSADOR_FIELD_GROUPS) as Array<
    keyof typeof AMBASSADOR_FIELD_GROUPS
>;

const LONG_FIELDS: ReadonlySet<AmbassadorTextField> = new Set([
    "heroLede",
    "rewardLede",
    "faq1Answer",
    "faq2Answer",
    "faq3Answer",
    "faq4Answer",
    "faq5Answer",
]);

/** Same default/custom/none photo logic for both previews. */
function heroImageUrlFor(
    photo: AmbassadorPhotoMode,
    heroImageUrl: string,
    explorerHeroImageUrl: string | undefined
) {
    return photo === "none"
        ? undefined
        : (photo === "custom" && heroImageUrl.trim()) || explorerHeroImageUrl;
}

/**
 * The whole copy the phone draws: built-in page copy for the tab language,
 * overlaid by the tab wording of the 18 editable fields.
 */
function resolvePhoneTexts(
    copy: AmbassadorCopy,
    texts: AmbassadorFormValues["texts"],
    lang: WordingLang,
    builtInLang: Language
): AmbassadorPhoneTexts {
    const wording = (field: AmbassadorTextField) =>
        tabWording(texts[field], lang, builtInLang, builtInText(copy, field));
    return {
        ...copy,
        heroTitle: wording("heroTitle"),
        heroLede: wording("heroLede"),
        heroRewardCaption: wording("heroRewardCaption"),
        heroCtaLabel: wording("heroCtaLabel"),
        heroPill: copy.heroRewardRefereePill,
        rewardHeading: wording("rewardHeading"),
        rewardLede: wording("rewardLede"),
        rewardCtaLabel: wording("rewardCtaLabel"),
        referralCtaLabel: wording("referralCtaLabel"),
        faq1Question: wording("faq1Question"),
        faq1Answer: wording("faq1Answer"),
        faq2Question: wording("faq2Question"),
        faq2Answer: wording("faq2Answer"),
        faq3Question: wording("faq3Question"),
        faq3Answer: wording("faq3Answer"),
        faq4Question: wording("faq4Question"),
        faq4Answer: wording("faq4Answer"),
        faq5Question: wording("faq5Question"),
        faq5Answer: wording("faq5Answer"),
    };
}

/**
 * A tab's own tier, then "all languages", then built-in copy; never another
 * language. The "all languages" tab shows what the store's own language renders.
 */
function tabWording(
    value: LocalizedText,
    lang: WordingLang,
    builtInLang: Language,
    fallback: string
) {
    return value[lang] || value.default || value[builtInLang] || fallback;
}

/**
 * Store-wide settings of `<frak-ambassador>`, in `sdkConfig.components.ambassador`.
 * Always mounted: the page exists once per store, so it has no placement tab.
 */
export function AmbassadorPagePanel({
    merchantId,
    sdkConfig,
    shopName,
    explorerHeroImageUrl,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
    shopName: string;
    explorerHeroImageUrl: string | undefined;
}) {
    const { t } = useTranslation();
    const { saveComponents, isSuccess } = useSaveComponents(merchantId);
    const [activeLang, setActiveLang] = useState<WordingLang>("default");
    const [focus, setFocus] = useState<AmbassadorPhoneFocus | undefined>(
        undefined
    );
    const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
    const reportFocus = useCallback((slot: string) => {
        setFocus((previous) => ({
            slot,
            counter: (previous?.counter ?? 0) + 1,
        }));
    }, []);

    const values = useMemo(
        () => ambassadorToFormValues(sdkConfig.components?.ambassador),
        [sdkConfig.components?.ambassador]
    );
    const form = useForm<AmbassadorFormValues>({ values });

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    const onSubmit = useCallback(
        (v: AmbassadorFormValues) =>
            saveComponents({ ambassador: formValuesToAmbassador(v) }),
        [saveComponents]
    );

    useCustomizeSection(SECTION_KEYS.ambassador, form, onSubmit);

    const builtInLang = resolveBuiltInLang(activeLang, sdkConfig.lang);
    const copy = componentDefaults[builtInLang].ambassador;

    return (
        <Form {...form}>
            <div className={customizeStyles.ambassadorRow}>
                <Card radius="m">
                    <Stack space="m">
                        <Stack space="xxs">
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                            >
                                {t("customize.ambassador.title")}
                            </Text>
                            <Text variant="caption" color="tertiary">
                                {t("customize.ambassador.description")}
                            </Text>
                        </Stack>

                        <WordingLangTabs
                            selected={activeLang}
                            onSelect={setActiveLang}
                        />

                        <div className={customizeStyles.inlineHeroOnly}>
                            <PreviewWrapper
                                label={t("customize.ambassador.preview")}
                            >
                                <HeroPreview
                                    form={form}
                                    lang={activeLang}
                                    builtInLang={builtInLang}
                                    copy={copy}
                                    currency={sdkConfig.currency ?? "eur"}
                                    shopName={shopName}
                                    explorerHeroImageUrl={explorerHeroImageUrl}
                                />
                            </PreviewWrapper>
                            <div>
                                <Button
                                    variant="secondary"
                                    width="auto"
                                    onClick={() => setFullPreviewOpen(true)}
                                >
                                    {t("customize.ambassador.fullPreview")}
                                </Button>
                            </div>
                        </div>

                        <HeroPhotoField
                            form={form}
                            merchantId={merchantId}
                            hasExplorerImage={Boolean(explorerHeroImageUrl)}
                            onHeroFocus={() => reportFocus("hero")}
                        />

                        <ToneSection
                            form={form}
                            lang={activeLang}
                            builtInLang={builtInLang}
                            copy={copy}
                            shopName={shopName}
                            reportFocus={reportFocus}
                        />
                    </Stack>
                </Card>
                <div className={customizeStyles.phoneRail} aria-hidden="true">
                    <FloatingPhonePreview variant="sticky">
                        <PhonePreview
                            form={form}
                            lang={activeLang}
                            builtInLang={builtInLang}
                            copy={copy}
                            currency={sdkConfig.currency ?? "eur"}
                            shopName={shopName}
                            explorerHeroImageUrl={explorerHeroImageUrl}
                            focus={focus}
                        />
                    </FloatingPhonePreview>
                </div>
            </div>

            <ResponsiveModal
                open={fullPreviewOpen}
                onOpenChange={setFullPreviewOpen}
                title={t("customize.ambassador.fullPreview")}
                description={t("customize.ambassador.fullPreviewDescription")}
            >
                <div className={customizeStyles.fullPreviewPhone}>
                    <PhonePreview
                        form={form}
                        lang={activeLang}
                        builtInLang={builtInLang}
                        copy={copy}
                        currency={sdkConfig.currency ?? "eur"}
                        shopName={shopName}
                        explorerHeroImageUrl={explorerHeroImageUrl}
                        focus={fullPreviewOpen ? focus : undefined}
                    />
                </div>
            </ResponsiveModal>
        </Form>
    );
}

function AmbassadorFieldInput({
    form,
    field,
    lang,
    copy,
    reportFocus,
}: {
    form: UseFormReturn<AmbassadorFormValues>;
    field: AmbassadorTextField;
    lang: WordingLang;
    copy: AmbassadorCopy;
    reportFocus: (slot: string) => void;
}) {
    const { t } = useTranslation();
    return (
        <FormField
            control={form.control}
            name={`texts.${field}.${lang}`}
            render={({ field: input }) => {
                const props = {
                    maxLength: 500,
                    label: t(`customize.ambassador.fields.${field}`),
                    placeholder: builtInText(copy, field),
                    onFocus: () => reportFocus(field),
                    ...input,
                    // Visitors resolve their language before "all languages",
                    // so an all-languages edit replaces both translations.
                    onChange: (
                        event: ChangeEvent<
                            HTMLInputElement | HTMLTextAreaElement
                        >
                    ) => {
                        input.onChange(event);
                        if (lang !== "default") return;
                        form.setValue(`texts.${field}.en`, "", {
                            shouldDirty: true,
                        });
                        form.setValue(`texts.${field}.fr`, "", {
                            shouldDirty: true,
                        });
                    },
                };
                return (
                    <EditField>
                        <FormControl>
                            {LONG_FIELDS.has(field) ? (
                                <TextArea
                                    length="big"
                                    resize="none"
                                    rows={
                                        field.startsWith("faq") ? 6 : undefined
                                    }
                                    className={textareaMuted}
                                    {...props}
                                />
                            ) : (
                                <Input variant="bare" tone="muted" {...props} />
                            )}
                        </FormControl>
                    </EditField>
                );
            }}
        />
    );
}

/** Tone tiles for the 8 texts above the FAQ, then every text field under a disclosure. */
function ToneSection({
    form,
    lang,
    builtInLang,
    copy,
    shopName,
    reportFocus,
}: {
    form: UseFormReturn<AmbassadorFormValues>;
    lang: WordingLang;
    builtInLang: Language;
    copy: AmbassadorCopy;
    shopName: string;
    reportFocus: (slot: string) => void;
}) {
    const { t } = useTranslation();
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const watched = form.watch(TONE_PRESET_PATHS);
    const selected = matchAmbassadorTonePreset(watched);

    const pick = (value: string) => {
        const index = Number(value);
        const preset = AMBASSADOR_TONE_PRESETS[index];
        const isClassic = index === 0;
        for (const field of AMBASSADOR_TONE_PRESET_FIELDS) {
            form.setValue(`texts.${field}.default`, "", { shouldDirty: true });
            form.setValue(
                `texts.${field}.en`,
                isClassic ? "" : preset.en[field],
                { shouldDirty: true }
            );
            form.setValue(
                `texts.${field}.fr`,
                isClassic ? "" : preset.fr[field],
                { shouldDirty: true }
            );
        }
        reportFocus("heroTitle");
    };

    return (
        <Stack space="m">
            <RadioGroup
                value={selected !== null ? String(selected) : ""}
                onValueChange={pick}
            >
                <Tiles columns={{ mobile: 1, tablet: 2 }} space="m">
                    {AMBASSADOR_TONE_PRESETS.map((preset, index) => (
                        <PresetRow key={preset.key} value={String(index)}>
                            <Stack space="none" as="span">
                                <Text variant="body" weight="medium" as="span">
                                    {t(
                                        `customize.ambassador.tonePresets.${preset.key}`
                                    )}
                                </Text>
                                <Text
                                    variant="bodySmall"
                                    color="tertiary"
                                    as="span"
                                >
                                    {preset[builtInLang].heroTitle.replace(
                                        /\{BRAND\}/g,
                                        () => shopName
                                    )}
                                </Text>
                            </Stack>
                        </PresetRow>
                    ))}
                </Tiles>
            </RadioGroup>
            <AdvancedDisclosure
                label={t("customize.components.advanced")}
                isOpen={advancedOpen}
                onToggle={() => setAdvancedOpen(!advancedOpen)}
            >
                <Stack space="m">
                    <Text variant="caption" color="tertiary">
                        {t("customize.ambassador.tokenHint")}
                    </Text>
                    {AMBASSADOR_GROUPS.map((group) => (
                        <FieldGroup
                            key={group}
                            title={t(`customize.ambassador.groups.${group}`)}
                        >
                            {AMBASSADOR_FIELD_GROUPS[group].map((field) => (
                                <AmbassadorFieldInput
                                    key={field}
                                    form={form}
                                    field={field}
                                    lang={lang}
                                    copy={copy}
                                    reportFocus={reportFocus}
                                />
                            ))}
                        </FieldGroup>
                    ))}
                </Stack>
            </AdvancedDisclosure>
        </Stack>
    );
}

function HeroPhotoField({
    form,
    merchantId,
    hasExplorerImage,
    onHeroFocus,
}: {
    form: UseFormReturn<AmbassadorFormValues>;
    merchantId: string;
    hasExplorerImage: boolean;
    onHeroFocus: () => void;
}) {
    const { t } = useTranslation();
    const photo = form.watch("photo");
    const setUrl = (url: string) =>
        form.setValue("heroImageUrl", url, { shouldDirty: true });

    return (
        <div onFocusCapture={onHeroFocus}>
            <Stack space="xs">
                <Text variant="bodySmall" weight="medium" color="secondary">
                    {t("customize.ambassador.photo.label")}
                </Text>
                <SegmentedTabs
                    value={photo}
                    options={PHOTO_MODES}
                    labelFor={(mode: AmbassadorPhotoMode) =>
                        t(`customize.ambassador.photo.${mode}`)
                    }
                    onSelect={(mode) =>
                        form.setValue("photo", mode, { shouldDirty: true })
                    }
                />
                {photo === "default" && (
                    <Text variant="caption" color="tertiary">
                        {t(
                            hasExplorerImage
                                ? "customize.ambassador.photo.defaultHint"
                                : "customize.ambassador.photo.noExplorerHint"
                        )}
                    </Text>
                )}
                {photo === "custom" && (
                    <ImageUploadField
                        merchantId={merchantId}
                        type="hero"
                        uploadType="hero-extra"
                        value={form.watch("heroImageUrl")}
                        onChange={setUrl}
                        onUploadSuccess={setUrl}
                        hint={t("customize.ambassador.photo.customHint")}
                    />
                )}
            </Stack>
        </div>
    );
}

function HeroPreview({
    form,
    lang,
    builtInLang,
    copy,
    currency,
    shopName,
    explorerHeroImageUrl,
}: {
    form: UseFormReturn<AmbassadorFormValues>;
    lang: WordingLang;
    builtInLang: Language;
    copy: AmbassadorCopy;
    currency: NonNullable<SdkConfig["currency"]>;
    shopName: string;
    explorerHeroImageUrl: string | undefined;
}) {
    const { texts, photo, heroImageUrl } = form.watch();
    const wording = (field: AmbassadorTextField) =>
        tabWording(texts[field], lang, builtInLang, builtInText(copy, field));

    return (
        <AmbassadorHeroPreview
            eyebrow={copy.heroEyebrow}
            title={wording("heroTitle")}
            lede={wording("heroLede")}
            ctaLabel={wording("heroCtaLabel")}
            rewardCaption={wording("heroRewardCaption")}
            caption={copy.heroFacesCaption}
            currency={currency}
            shopName={shopName}
            imageUrl={heroImageUrlFor(
                photo,
                heroImageUrl,
                explorerHeroImageUrl
            )}
        />
    );
}

function PhonePreview({
    form,
    lang,
    builtInLang,
    copy,
    currency,
    shopName,
    explorerHeroImageUrl,
    focus,
}: {
    form: UseFormReturn<AmbassadorFormValues>;
    lang: WordingLang;
    builtInLang: Language;
    copy: AmbassadorCopy;
    currency: NonNullable<SdkConfig["currency"]>;
    shopName: string;
    explorerHeroImageUrl: string | undefined;
    focus: AmbassadorPhoneFocus | undefined;
}) {
    const { texts, photo, heroImageUrl } = form.watch();

    return (
        <AmbassadorPhonePreview
            texts={resolvePhoneTexts(copy, texts, lang, builtInLang)}
            currency={currency}
            shopName={shopName}
            imageUrl={heroImageUrlFor(
                photo,
                heroImageUrl,
                explorerHeroImageUrl
            )}
            focus={focus}
        />
    );
}
