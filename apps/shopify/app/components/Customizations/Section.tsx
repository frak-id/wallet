import { useTranslation } from "react-i18next";
import { ConfirmationPreview, SharingPreview } from "../SharingPagePreview";
import { SocialPreview } from "../SocialPreview";

const SHARING_FIELD_KEYS = ["sharing.title", "sharing.text"];

const SHARING_PAGE_FIELD_KEYS = [
    "sdk.sharingPage.reward.title",
    "sdk.sharingPage.reward.tagline",
    "sdk.sharingPage.confirmation.title",
    "sdk.sharingPage.confirmation.cta",
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

// Sharing Page Section Component
export function SharingPageSection({
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
                <s-stack gap="small">
                    <div>
                        <s-heading>
                            {t("customizations.sharingPage.formatting.title")}
                        </s-heading>
                        <s-text tone="neutral">
                            {t(
                                "customizations.sharingPage.formatting.description"
                            )}
                        </s-text>
                    </div>
                    <s-stack gap="small">
                        <div>
                            <s-text>
                                •{" "}
                                {t(
                                    "customizations.sharingPage.formatting.variable"
                                )}
                            </s-text>
                        </div>
                        <div>
                            <s-text>
                                •{" "}
                                {t(
                                    "customizations.sharingPage.formatting.productName"
                                )}
                            </s-text>
                        </div>
                        <div>
                            <s-text tone="neutral">
                                •{" "}
                                {t(
                                    "customizations.sharingPage.formatting.preview"
                                )}
                            </s-text>
                        </div>
                    </s-stack>
                </s-stack>
            </s-section>
            <s-section>
                <s-stack gap="base">
                    <div>
                        <s-heading>
                            {t("customizations.sharingPage.title")}
                        </s-heading>
                        <s-text tone="neutral">
                            {t("customizations.sharingPage.description")}
                        </s-text>
                    </div>
                    {SHARING_PAGE_FIELD_KEYS.map((key) => (
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
                <SharingPreviewSection
                    title={t("customizations.preview.sharingPage.title")}
                    description={t(
                        "customizations.preview.sharingPage.description"
                    )}
                    rewardTitle={handleValue(
                        values["sdk.sharingPage.reward.title"],
                        t("customizations.preview.sharingPage.rewardTitle")
                    )}
                    rewardTagline={handleValue(
                        values["sdk.sharingPage.reward.tagline"],
                        t("customizations.preview.sharingPage.rewardTagline")
                    )}
                />
                <SharingPreviewSection
                    title={t("customizations.preview.confirmation.title")}
                    description={t(
                        "customizations.preview.confirmation.description"
                    )}
                    confirmationTitle={handleValue(
                        values["sdk.sharingPage.confirmation.title"],
                        t(
                            "customizations.preview.confirmation.confirmationTitle"
                        )
                    )}
                    confirmationCta={handleValue(
                        values["sdk.sharingPage.confirmation.cta"],
                        t("customizations.preview.confirmation.confirmationCta")
                    )}
                />
            </div>
        </>
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

type SharingPreviewSectionProps =
    | {
          title: string;
          description: string;
          rewardTitle: string;
          rewardTagline: string;
          confirmationTitle?: undefined;
          confirmationCta?: undefined;
      }
    | {
          title: string;
          description: string;
          rewardTitle?: undefined;
          rewardTagline?: undefined;
          confirmationTitle: string;
          confirmationCta: string;
      };

function SharingPreviewSection(props: SharingPreviewSectionProps) {
    return (
        <s-section>
            <s-stack gap="base">
                <div>
                    <s-heading>{props.title}</s-heading>
                    <s-text tone="neutral">{props.description}</s-text>
                </div>
                {props.rewardTitle !== undefined ? (
                    <SharingPreview
                        rewardTitle={props.rewardTitle}
                        rewardTagline={props.rewardTagline}
                    />
                ) : (
                    <ConfirmationPreview
                        confirmationTitle={props.confirmationTitle}
                        confirmationCta={props.confirmationCta}
                    />
                )}
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
