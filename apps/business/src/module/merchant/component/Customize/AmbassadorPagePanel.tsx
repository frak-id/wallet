import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { componentDefaults } from "@frak-labs/components/i18n/defaults";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { TextArea } from "@frak-labs/design-system/components/TextArea";
import {
    AmbassadorHeroPreview,
    type AmbassadorPhoneFocus,
    AmbassadorPhonePreview,
    type AmbassadorPhoneTexts,
} from "@frak-labs/ui-preview";
import { useCallback, useEffect, useMemo, useState } from "react";
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
    type AmbassadorFormValues,
    type AmbassadorPhotoMode,
    type AmbassadorTextField,
    ambassadorToFormValues,
    formValuesToAmbassador,
} from "./ambassadorForm";
import { WordingLangTabs } from "./ComponentEditor";
import * as customizeStyles from "./customize.css";
import { FieldGroup } from "./fields/shared";
import { resolveBuiltInLang } from "./localizable";
import { SegmentedTabs } from "./SegmentedTabs";
import { SECTION_KEYS } from "./sections";
import type { LocalizedText, WordingLang } from "./types";
import { useSaveComponents } from "./useSaveComponents";

type AmbassadorCopy = (typeof componentDefaults)["en"]["ambassador"];

const PHOTO_MODES = ["default", "custom", "none"] as const;

const LONG_FIELDS: ReadonlySet<AmbassadorTextField> = new Set([
    "heroLede",
    "rewardLede",
    "faq1Answer",
    "faq2Answer",
    "faq3Answer",
    "faq4Answer",
    "faq5Answer",
]);

/** The built-in copy a field falls back to, as the page renders it with an amount. */
function builtInText(copy: AmbassadorCopy, field: AmbassadorTextField) {
    switch (field) {
        case "heroTitle":
            return copy.heroHeadline;
        case "heroLede":
            return copy.heroLedeReward;
        case "rewardHeading":
            return copy.rewardHeadingReward;
        case "faq5Answer":
            return `${copy.faq5AnswerBeforeLink}${copy.faq5AnswerLinkText}${copy.faq5AnswerAfterLink}`;
        default:
            return copy[field];
    }
}

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
    lang: WordingLang
): AmbassadorPhoneTexts {
    const wording = (field: AmbassadorTextField) =>
        tabWording(texts[field], lang, builtInText(copy, field));
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

/** Mirrors the backend: a tab's own tier, then "all languages", never another language. */
function tabWording(value: LocalizedText, lang: WordingLang, fallback: string) {
    return value[lang] || value.default || fallback;
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

    const copy =
        componentDefaults[resolveBuiltInLang(activeLang, sdkConfig.lang)]
            .ambassador;

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

                        <Text variant="caption" color="tertiary">
                            {t("customize.ambassador.tokenHint")}
                        </Text>

                        {(
                            Object.keys(AMBASSADOR_FIELD_GROUPS) as Array<
                                keyof typeof AMBASSADOR_FIELD_GROUPS
                            >
                        ).map((group) => (
                            <FieldGroup
                                key={group}
                                title={t(
                                    `customize.ambassador.groups.${group}`
                                )}
                            >
                                {AMBASSADOR_FIELD_GROUPS[group].map((field) => (
                                    <FormField
                                        key={field}
                                        control={form.control}
                                        name={`texts.${field}.${activeLang}`}
                                        render={({ field: input }) => {
                                            const props = {
                                                maxLength: 500,
                                                label: t(
                                                    `customize.ambassador.fields.${field}`
                                                ),
                                                placeholder: builtInText(
                                                    copy,
                                                    field
                                                ),
                                                onFocus: () =>
                                                    reportFocus(field),
                                                ...input,
                                            };
                                            return (
                                                <EditField>
                                                    <FormControl>
                                                        {LONG_FIELDS.has(
                                                            field
                                                        ) ? (
                                                            <TextArea
                                                                length="big"
                                                                resize="none"
                                                                rows={
                                                                    field.startsWith(
                                                                        "faq"
                                                                    )
                                                                        ? 6
                                                                        : undefined
                                                                }
                                                                className={
                                                                    textareaMuted
                                                                }
                                                                {...props}
                                                            />
                                                        ) : (
                                                            <Input
                                                                variant="bare"
                                                                tone="muted"
                                                                {...props}
                                                            />
                                                        )}
                                                    </FormControl>
                                                </EditField>
                                            );
                                        }}
                                    />
                                ))}
                            </FieldGroup>
                        ))}
                    </Stack>
                </Card>
                <div className={customizeStyles.phoneRail} aria-hidden="true">
                    <FloatingPhonePreview variant="sticky">
                        <PhonePreview
                            form={form}
                            lang={activeLang}
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
    copy,
    currency,
    shopName,
    explorerHeroImageUrl,
}: {
    form: UseFormReturn<AmbassadorFormValues>;
    lang: WordingLang;
    copy: AmbassadorCopy;
    currency: NonNullable<SdkConfig["currency"]>;
    shopName: string;
    explorerHeroImageUrl: string | undefined;
}) {
    const { texts, photo, heroImageUrl } = form.watch();
    const wording = (field: AmbassadorTextField) =>
        tabWording(texts[field], lang, builtInText(copy, field));

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
    copy,
    currency,
    shopName,
    explorerHeroImageUrl,
    focus,
}: {
    form: UseFormReturn<AmbassadorFormValues>;
    lang: WordingLang;
    copy: AmbassadorCopy;
    currency: NonNullable<SdkConfig["currency"]>;
    shopName: string;
    explorerHeroImageUrl: string | undefined;
    focus: AmbassadorPhoneFocus | undefined;
}) {
    const { texts, photo, heroImageUrl } = form.watch();

    return (
        <AmbassadorPhonePreview
            texts={resolvePhoneTexts(copy, texts, lang)}
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
