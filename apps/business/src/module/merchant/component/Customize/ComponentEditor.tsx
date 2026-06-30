import { componentDefaults } from "@frak-labs/components/i18n/defaults";
import type { Currency, Language } from "@frak-labs/core-sdk";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Text } from "@frak-labs/design-system/components/Text";
import { ChevronDownIcon, ChevronUpIcon } from "@frak-labs/design-system/icons";
import {
    BannerPreview,
    PostPurchasePreview,
    ShareButtonPreview,
} from "@frak-labs/ui-preview";
import type { ReactNode } from "react";
import { useState } from "react";
import type { FieldPath, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ImageUploadField } from "@/module/merchant/component/ImageUploadField";
import * as styles from "./customize.css";
import { BannerFields } from "./fields/BannerFields";
import { ButtonShareFields } from "./fields/ButtonShareFields";
import { PostPurchaseFields } from "./fields/PostPurchaseFields";
import { RewardTokenHint } from "./fields/shared";
import { resolveBuiltInLang, resolvePreviewWording } from "./localizable";
import { COMPONENT_LABEL_KEYS } from "./translations";
import type {
    ComponentSettingsFormValues,
    ComponentType,
    WordingLang,
} from "./types";
import { COMPONENT_TYPES, SUPPORTED_WORDING_LANGS } from "./types";

const WORDING_LANG_LABELS: Record<WordingLang, string> = {
    default: "Default",
    en: "English",
    fr: "Français",
};

export function WordingLangTabs({
    selected,
    onSelect,
}: {
    selected: WordingLang;
    onSelect: (lang: WordingLang) => void;
}) {
    return (
        <Tabs
            value={selected}
            onValueChange={(value) => onSelect(value as WordingLang)}
        >
            <TabsList
                variant="segmented"
                fullWidth
                className={styles.segmentedTrack}
            >
                {SUPPORTED_WORDING_LANGS.map((lang) => (
                    <TabsTrigger
                        key={lang}
                        value={lang}
                        variant="segmented"
                        fullWidth
                    >
                        {WORDING_LANG_LABELS[lang]}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}

export function ComponentTypeTabs({
    selected,
    onSelect,
}: {
    selected: ComponentType;
    onSelect: (componentType: ComponentType) => void;
}) {
    const { t } = useTranslation();
    return (
        <Tabs
            value={selected}
            onValueChange={(value) => onSelect(value as ComponentType)}
        >
            <TabsList
                variant="segmented"
                fullWidth
                className={styles.segmentedTrack}
            >
                {COMPONENT_TYPES.map((componentType) => (
                    <TabsTrigger
                        key={componentType}
                        value={componentType}
                        variant="segmented"
                        fullWidth
                    >
                        {t(COMPONENT_LABEL_KEYS[componentType])}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}

export function AdvancedDisclosure({
    label,
    isOpen,
    onToggle,
    children,
}: {
    label: string;
    isOpen: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    return (
        <div>
            <button
                type="button"
                className={styles.advancedToggle}
                onClick={onToggle}
                aria-expanded={isOpen}
            >
                {isOpen ? (
                    <ChevronUpIcon width={16} height={16} />
                ) : (
                    <ChevronDownIcon width={16} height={16} />
                )}
                {label}
            </button>
            {isOpen && <div className={styles.advancedBody}>{children}</div>}
        </div>
    );
}

export function ComponentFields({
    selectedComponent,
    form,
    lang,
}: {
    selectedComponent: ComponentType;
    form: UseFormReturn<ComponentSettingsFormValues>;
    lang: WordingLang;
}) {
    return (
        <Stack space="m">
            <RewardTokenHint />
            <ComponentFieldsBody
                selectedComponent={selectedComponent}
                form={form}
                lang={lang}
            />
        </Stack>
    );
}

function ComponentFieldsBody({
    selectedComponent,
    form,
    lang,
}: {
    selectedComponent: ComponentType;
    form: UseFormReturn<ComponentSettingsFormValues>;
    lang: WordingLang;
}) {
    switch (selectedComponent) {
        case "buttonShare":
            return <ButtonShareFields form={form} lang={lang} />;
        case "postPurchase":
            return <PostPurchaseFields form={form} lang={lang} />;
        case "banner":
            return <BannerFields form={form} lang={lang} />;
    }
}

/**
 * Custom illustration picker (URL input + drag-n-drop) shown under the wording
 * suggestions. Only the post-purchase card and the banner display an icon, so
 * the picker hides itself for the share button.
 */
export function ComponentImagePicker({
    selectedComponent,
    form,
    merchantId,
}: {
    selectedComponent: ComponentType;
    form: UseFormReturn<ComponentSettingsFormValues>;
    merchantId: string;
}) {
    const { t } = useTranslation();

    if (
        selectedComponent !== "postPurchase" &&
        selectedComponent !== "banner"
    ) {
        return null;
    }

    const name =
        `${selectedComponent}.imageUrl` as FieldPath<ComponentSettingsFormValues>;
    const value = form.watch(name) as string;

    return (
        <Stack space="xxs">
            <Text variant="bodySmall" weight="medium" color="secondary">
                {t("customize.components.image.label")}
            </Text>
            <Text variant="caption" color="tertiary">
                {t("customize.components.image.description")}
            </Text>
            <ImageUploadField
                merchantId={merchantId}
                type="icon"
                value={value}
                onChange={(v) => form.setValue(name, v, { shouldDirty: true })}
                onUploadSuccess={(url) =>
                    form.setValue(name, url, { shouldDirty: true })
                }
                hint={t("customize.components.image.hint")}
            />
        </Stack>
    );
}

type PostPurchasePreviewMode = "referee" | "referrer";

/**
 * Post-purchase modal preview with a referee/referrer toggle: both audiences
 * share the badge + CTA but get a different message, so merchants can check
 * each modal without leaving the editor.
 */
function PostPurchasePreviewModes({
    values,
    lang,
    defaults,
    currency,
    shopName,
}: {
    values: ComponentSettingsFormValues;
    lang: WordingLang;
    defaults: (typeof componentDefaults)[Language];
    currency: Currency;
    shopName: string;
}) {
    const { t } = useTranslation();
    const [mode, setMode] = useState<PostPurchasePreviewMode>("referee");
    const imageUrl = values.postPurchase.imageUrl || undefined;

    const messageText =
        mode === "referee"
            ? resolvePreviewWording(
                  values.postPurchase.refereeText,
                  lang,
                  defaults.postPurchase.refereeText
              )
            : resolvePreviewWording(
                  values.postPurchase.referrerText,
                  lang,
                  defaults.postPurchase.referrerText
              );

    return (
        <Stack space="s">
            <Tabs
                value={mode}
                onValueChange={(value) =>
                    setMode(value as PostPurchasePreviewMode)
                }
            >
                <TabsList
                    variant="segmented"
                    fullWidth
                    className={styles.segmentedTrack}
                >
                    <TabsTrigger value="referee" variant="segmented" fullWidth>
                        {t("customize.components.postPurchasePreview.referee")}
                    </TabsTrigger>
                    <TabsTrigger value="referrer" variant="segmented" fullWidth>
                        {t("customize.components.postPurchasePreview.referrer")}
                    </TabsTrigger>
                </TabsList>
            </Tabs>
            <PostPurchasePreview
                badgeText={resolvePreviewWording(
                    values.postPurchase.badgeText,
                    lang,
                    ""
                )}
                messageText={messageText}
                ctaText={resolvePreviewWording(
                    values.postPurchase.ctaText,
                    lang,
                    defaults.postPurchase.ctaText
                )}
                imageUrl={imageUrl}
                currency={currency}
                shopName={shopName}
            />
        </Stack>
    );
}

export function ComponentPreview({
    selectedComponent,
    form,
    currency,
    shopName,
    lang,
    configLang,
}: {
    selectedComponent: ComponentType;
    form: UseFormReturn<ComponentSettingsFormValues>;
    currency: Currency;
    shopName: string;
    lang: WordingLang;
    configLang: Language | null | undefined;
}) {
    const values = form.watch();
    const defaults = componentDefaults[resolveBuiltInLang(lang, configLang)];

    switch (selectedComponent) {
        case "buttonShare":
            return (
                <ShareButtonPreview
                    text={resolvePreviewWording(
                        values.buttonShare.text,
                        lang,
                        defaults.buttonShare.text
                    )}
                    currency={currency}
                    shopName={shopName}
                />
            );
        case "postPurchase":
            return (
                <PostPurchasePreviewModes
                    values={values}
                    lang={lang}
                    defaults={defaults}
                    currency={currency}
                    shopName={shopName}
                />
            );
        case "banner":
            return (
                <BannerPreview
                    title={resolvePreviewWording(
                        values.banner.referralTitle,
                        lang,
                        defaults.banner.referralTitleReward
                    )}
                    description={resolvePreviewWording(
                        values.banner.referralDescription,
                        lang,
                        defaults.banner.referralDescription
                    )}
                    ctaText={resolvePreviewWording(
                        values.banner.referralCta,
                        lang,
                        defaults.banner.referralCta
                    )}
                    imageUrl={values.banner.imageUrl || undefined}
                    currency={currency}
                    shopName={shopName}
                />
            );
    }
}
