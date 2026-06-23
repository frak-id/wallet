import { componentDefaults } from "@frak-labs/components/i18n/defaults";
import type { Currency, Language } from "@frak-labs/core-sdk";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { ChevronDownIcon, ChevronUpIcon } from "@frak-labs/design-system/icons";
import {
    BannerPreview,
    PostPurchasePreview,
    ShareButtonPreview,
} from "@frak-labs/ui-preview";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as styles from "./customize.css";
import { BannerFields } from "./fields/BannerFields";
import { ButtonShareFields } from "./fields/ButtonShareFields";
import { PostPurchaseFields } from "./fields/PostPurchaseFields";
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
    switch (selectedComponent) {
        case "buttonShare":
            return <ButtonShareFields form={form} lang={lang} />;
        case "postPurchase":
            return <PostPurchaseFields form={form} lang={lang} />;
        case "banner":
            return <BannerFields form={form} lang={lang} />;
    }
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
                <PostPurchasePreview
                    messageText={resolvePreviewWording(
                        values.postPurchase.refereeText,
                        lang,
                        defaults.postPurchase.refereeText
                    )}
                    ctaText={resolvePreviewWording(
                        values.postPurchase.ctaText,
                        lang,
                        defaults.postPurchase.ctaText
                    )}
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
                    currency={currency}
                    shopName={shopName}
                />
            );
    }
}
