import type { Currency } from "@frak-labs/core-sdk";
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
}: {
    selectedComponent: ComponentType;
    form: UseFormReturn<ComponentSettingsFormValues>;
    currency: Currency;
    shopName: string;
    lang: WordingLang;
}) {
    const values = form.watch();

    switch (selectedComponent) {
        case "buttonShare":
            return (
                <ShareButtonPreview
                    text={values.buttonShare.text[lang] || "Share and earn!"}
                    currency={currency}
                    shopName={shopName}
                />
            );
        case "postPurchase":
            return (
                <PostPurchasePreview
                    messageText={
                        values.postPurchase.refereeText[lang] ||
                        "You just earned {REWARD}! Share with friends to earn even more."
                    }
                    ctaText={
                        values.postPurchase.ctaText[lang] ||
                        "Share & earn {REWARD}"
                    }
                    currency={currency}
                    shopName={shopName}
                />
            );
        case "banner":
            return (
                <BannerPreview
                    title={
                        values.banner.referralTitle[lang] ||
                        "Earn {REWARD} on purchases"
                    }
                    description={
                        values.banner.referralDescription[lang] ||
                        "Earn rewards after your purchase via the Frak partner app."
                    }
                    ctaText={values.banner.referralCta[lang] || "Got it"}
                    currency={currency}
                    shopName={shopName}
                />
            );
    }
}
