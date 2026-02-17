import { useTranslation } from "react-i18next";
import type { I18nCustomizations } from "../../services.server/metafields";
import { ModalSection, SharingSection } from "./Section";

// Single Language Fields Component
export function SingleLanguageFields({
    customizations,
    onUpdate,
    logoUrl,
}: {
    logoUrl?: string;
    customizations: I18nCustomizations;
    onUpdate: (key: string, value: string) => void;
}) {
    // Use 'en' as the default language for single mode and merge logoUrl if provided
    const currentValues = customizations.en || {};

    return (
        <s-stack gap="large">
            <ModalSection
                values={currentValues}
                onUpdate={onUpdate}
                logoUrl={logoUrl}
                language="single"
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
    logoUrl?: string;
    onUpdate: (language: "fr" | "en", key: string, value: string) => void;
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
                    <ModalSection
                        values={frValues}
                        onUpdate={(key, value) => onUpdate("fr", key, value)}
                        logoUrl={logoUrl}
                        language="fr"
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
                    <ModalSection
                        values={enValues}
                        onUpdate={(key, value) => onUpdate("en", key, value)}
                        logoUrl={logoUrl}
                        language="en"
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
}: {
    logoUrl: string;
    onUpdate: (logoUrl: string) => void;
}) {
    const { t } = useTranslation();
    return (
        <s-section>
            <s-stack gap="base">
                <s-heading>{t("customizations.modal.logo.title")}</s-heading>
                <s-text>{t("customizations.modal.logo.description")}</s-text>
                <s-text-area
                    label={t("customizations.fields.logoUrl.label")}
                    placeholder={t("customizations.fields.logoUrl.placeholder")}
                    value={logoUrl || ""}
                    onChange={(e) => onUpdate(e.currentTarget.value)}
                    autocomplete="off"
                />
            </s-stack>
        </s-section>
    );
}
