import { useTranslation } from "react-i18next";
import type { I18nCustomizations } from "../../services.server/metafields";
import { ImageUploadField } from "../Appearance/ImageUploadField";
import { SharingPageSection, SharingSection } from "./Section";

// Single Language Fields Component
export function SingleLanguageFields({
    customizations,
    onUpdate,
    logoUrl,
}: {
    customizations: I18nCustomizations;
    onUpdate: (key: string, value: string) => void;
    logoUrl?: string;
}) {
    // Use 'en' as the default language for single mode and merge logoUrl if provided
    const currentValues = customizations.en || {};

    return (
        <s-stack gap="large">
            <SharingPageSection
                values={currentValues}
                onUpdate={onUpdate}
                language="single"
                logoUrl={logoUrl}
            />
            <SharingSection
                values={currentValues}
                onUpdate={onUpdate}
                language="single"
            />
        </s-stack>
    );
}
// Multi Language Fields Component
export function MultiLanguageFields({
    customizations,
    onUpdate,
    logoUrl,
}: {
    customizations: I18nCustomizations;
    onUpdate: (language: "fr" | "en", key: string, value: string) => void;
    logoUrl?: string;
}) {
    // Merge logoUrl into per-language values so the preview can access it
    const frValues = customizations.fr || {};
    const enValues = customizations.en || {};

    return (
        <s-stack gap="large">
            {/* French */}
            <s-section>
                <s-stack gap="base">
                    <s-heading>French (Français)</s-heading>
                    <SharingPageSection
                        values={frValues}
                        onUpdate={(key, value) => onUpdate("fr", key, value)}
                        language="fr"
                        logoUrl={logoUrl}
                    />
                    <SharingSection
                        values={frValues}
                        onUpdate={(key, value) => onUpdate("fr", key, value)}
                        language="fr"
                    />
                </s-stack>
            </s-section>

            {/* English */}
            <s-section>
                <s-stack gap="base">
                    <s-heading>English</s-heading>
                    <SharingPageSection
                        values={enValues}
                        onUpdate={(key, value) => onUpdate("en", key, value)}
                        language="en"
                        logoUrl={logoUrl}
                    />
                    <SharingSection
                        values={enValues}
                        onUpdate={(key, value) => onUpdate("en", key, value)}
                        language="en"
                    />
                </s-stack>
            </s-section>
        </s-stack>
    );
}

// Logo Field Component
export function LogoField({
    logoUrl,
    onUpdate,
    onUploadSuccess,
    mediaFiles,
}: {
    logoUrl: string;
    onUpdate: (logoUrl: string) => void;
    onUploadSuccess: (url: string) => void;
    mediaFiles?: { type: string; url: string }[];
}) {
    const { t } = useTranslation();
    return (
        <s-section>
            <s-stack gap="base">
                <s-heading>{t("customizations.logo.title")}</s-heading>
                <s-text>{t("customizations.logo.description")}</s-text>
                <ImageUploadField
                    type="logo"
                    value={logoUrl || ""}
                    onChange={onUpdate}
                    onUploadSuccess={onUploadSuccess}
                    label={t("customizations.fields.logoUrl.label")}
                    placeholder={t("customizations.fields.logoUrl.placeholder")}
                    mediaFiles={mediaFiles}
                />
            </s-stack>
        </s-section>
    );
}
