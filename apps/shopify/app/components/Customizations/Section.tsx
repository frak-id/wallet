import { useTranslation } from "react-i18next";
import { ModalPreview } from "../ModalPreview";
import { SocialPreview } from "../SocialPreview";

const SHARING_FIELD_KEYS = ["sharing.title", "sharing.text"];

const MODAL_FIELD_KEYS = [
    "sdk.wallet.login.text_sharing",
    "sdk.wallet.login.text_referred",
    "sdk.wallet.login.primaryAction",
];

// Sharing Section Component
export function SharingSection({
    values,
    onUpdate,
    language,
}: {
    values: Record<string, string>;
    onUpdate: (key: string, value: string) => void;
    language: string;
}) {
    const { t } = useTranslation();

    return (
        <>
            <s-section>
                <s-stack gap="base">
                    <div>
                        <s-heading>
                            {t("customizations.sharing.title")}
                        </s-heading>
                        <s-text tone="neutral">
                            {t("customizations.sharing.description")}
                        </s-text>
                    </div>
                    {SHARING_FIELD_KEYS.map((key) => {
                        const isMultiline = key.includes("text");
                        return isMultiline ? (
                            <s-text-area
                                key={`${language}-${key}`}
                                label={t(`customizations.fields.${key}.label`)}
                                placeholder={t(
                                    `customizations.fields.${key}.placeholder`
                                )}
                                value={values[key] || ""}
                                onChange={(e) =>
                                    onUpdate(key, e.currentTarget.value)
                                }
                                autocomplete="off"
                            />
                        ) : (
                            <s-text-field
                                key={`${language}-${key}`}
                                label={t(`customizations.fields.${key}.label`)}
                                placeholder={t(
                                    `customizations.fields.${key}.placeholder`
                                )}
                                value={values[key] || ""}
                                onChange={(e) =>
                                    onUpdate(key, e.currentTarget.value)
                                }
                                autocomplete="off"
                            />
                        );
                    })}
                </s-stack>
            </s-section>
            <SocialPreviewSection
                title={t("customizations.preview.social.title")}
                description={t("customizations.preview.social.description")}
                sharingTitle={values["sharing.title"]}
                sharingText={values["sharing.text"]}
            />
        </>
    );
}

// Modal Section Component
export function ModalSection({
    values,
    onUpdate,
    logoUrl,
    language,
}: {
    values: Record<string, string>;
    onUpdate: (key: string, value: string) => void;
    logoUrl?: string;
    language: string;
}) {
    const { t } = useTranslation();
    return (
        <>
            <s-section>
                <s-stack gap="small">
                    <div>
                        <s-heading>
                            {t("customizations.modal.formatting.title")}
                        </s-heading>
                        <s-text tone="neutral">
                            {t("customizations.modal.formatting.description")}
                        </s-text>
                    </div>
                    <s-stack gap="small">
                        <div>
                            <s-text>
                                • {t("customizations.modal.formatting.bold")}
                            </s-text>
                        </div>
                        <div>
                            <s-text>
                                • {t("customizations.modal.formatting.italic")}
                            </s-text>
                        </div>
                        <div>
                            <s-text>
                                •{" "}
                                {t("customizations.modal.formatting.variable")}
                            </s-text>
                        </div>
                        <div>
                            <s-text tone="neutral">
                                • {t("customizations.modal.formatting.preview")}
                            </s-text>
                        </div>
                    </s-stack>
                </s-stack>
            </s-section>
            <s-section>
                <s-stack gap="base">
                    <div>
                        <s-heading>{t("customizations.modal.title")}</s-heading>
                        <s-text tone="neutral">
                            {t("customizations.modal.description")}
                        </s-text>
                    </div>
                    {MODAL_FIELD_KEYS.map((key) => (
                        <s-text-area
                            key={`${language}-${key}`}
                            label={t(`customizations.fields.${key}.label`)}
                            placeholder={t(
                                `customizations.fields.${key}.placeholder`
                            )}
                            value={values[key] || ""}
                            onChange={(e) =>
                                onUpdate(key, e.currentTarget.value)
                            }
                            autocomplete="off"
                        />
                    ))}
                </s-stack>
            </s-section>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1rem",
                }}
            >
                <ModalPreviewSection
                    title={t("customizations.preview.sharing.title")}
                    description={t(
                        "customizations.preview.sharing.description"
                    )}
                    text={handleValue(
                        values["sdk.wallet.login.text_sharing"],
                        t("customizations.preview.sharing.placeholder")
                    )}
                    button={handleValue(
                        values["sdk.wallet.login.primaryAction"],
                        t("customizations.preview.sharing.button")
                    )}
                    logoUrl={logoUrl}
                />
                <ModalPreviewSection
                    title={t("customizations.preview.referred.title")}
                    description={t(
                        "customizations.preview.referred.description"
                    )}
                    text={handleValue(
                        values["sdk.wallet.login.text_referred"],
                        t("customizations.preview.referred.placeholder")
                    )}
                    button={handleValue(
                        values["sdk.wallet.login.primaryAction"],
                        t("customizations.preview.referred.button")
                    )}
                    logoUrl={logoUrl}
                />
            </div>
        </>
    );
}

type ModalPreviewSectionProps = {
    title?: string;
    description?: string;
    text?: string;
    button?: string;
    logoUrl?: string;
};

export function ModalPreviewSection({
    title,
    description,
    text,
    button,
    logoUrl,
}: ModalPreviewSectionProps) {
    return (
        <s-section>
            <s-stack gap="base">
                <div>
                    <s-heading>{title}</s-heading>
                    <s-text tone="neutral">{description}</s-text>
                </div>
                <ModalPreview text={text} button={button} logoUrl={logoUrl} />
            </s-stack>
        </s-section>
    );
}

type SocialPreviewSectionProps = {
    title: string;
    description: string;
    sharingTitle: string;
    sharingText: string;
};

export function SocialPreviewSection({
    title,
    description,
    sharingTitle,
    sharingText,
}: SocialPreviewSectionProps) {
    const { t } = useTranslation();

    return (
        <s-section>
            <s-stack gap="base">
                <div>
                    <s-heading>{title}</s-heading>
                    <s-text tone="neutral">{description}</s-text>
                </div>
                <SocialPreview
                    title={handleValue(
                        sharingTitle,
                        t("customizations.preview.social.title")
                    )}
                    text={handleValue(
                        sharingText,
                        t("customizations.preview.social.description")
                    )}
                />
            </s-stack>
        </s-section>
    );
}

/**
 * Handle the value of the field.
 * If the value is not empty, return the value.
 * If the value is empty, return the default value.
 * @param value - The value of the field.
 * @param defaultValue - The default value of the field.
 * @returns The value of the field.
 */
function handleValue(value: string, defaultValue: string) {
    if (value && value !== "") {
        return value;
    }
    return defaultValue;
}
