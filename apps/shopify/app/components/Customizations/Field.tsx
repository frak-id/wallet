import { useTranslation } from "react-i18next";
import { ImageUploadField } from "../Appearance/ImageUploadField";

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
