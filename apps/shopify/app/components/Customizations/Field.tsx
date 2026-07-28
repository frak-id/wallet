import { useTranslation } from "react-i18next";
import { ImageUploadField } from "../Appearance/ImageUploadField";

// Logo Field Component
export function LogoField({
    logoUrl,
    onUpdate,
    onUploadSuccess,
    onRemove,
    mediaFiles,
    error,
}: {
    logoUrl: string;
    onUpdate: (logoUrl: string) => void;
    onUploadSuccess: (url: string) => void;
    onRemove?: (previousUrl: string) => void;
    mediaFiles?: { type: string; url: string }[];
    error?: string;
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
                    onRemove={onRemove}
                    label={t("customizations.fields.logoUrl.label")}
                    placeholder={t("customizations.fields.logoUrl.placeholder")}
                    mediaFiles={mediaFiles}
                    error={error}
                />
            </s-stack>
        </s-section>
    );
}
