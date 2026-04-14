import type { Currency } from "@frak-labs/core-sdk";
import {
    SharingPreview,
    SharingSuccessPreview,
    SocialPreview,
} from "@frak-labs/ui-preview";
import type { loader as rootLoader } from "app/routes/app";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";

const SHARING_FIELD_KEYS = ["sharing.title", "sharing.text"];

const SHARING_PAGE_FIELD_KEYS = [
    "sdk.sharingPage.reward.title",
    "sdk.sharingPage.reward.tagline",
    "sdk.sharingPage.confirmation.title",
    "sdk.sharingPage.confirmation.cta",
];

/**
 * Default English translations for the preview, sourced from wallet-shared i18n.
 */
const PREVIEW_DEFAULTS: Record<string, string> = {
    "sdk.sharingPage.dismiss": "Later",
    "sdk.sharingPage.reward.title": "Share with your friends",
    "sdk.sharingPage.reward.tagline":
        "You earn a reward every time a friend makes a purchase through your link.",
    "sdk.sharingPage.card.amount": "{{ estimatedReward }}",
    "sdk.sharingPage.card.label": "Credited to your account",
    "sdk.sharingPage.card.tagline1": "Earn {{ estimatedReward }},",
    "sdk.sharingPage.card.tagline2": "on every purchase!",
    "sdk.sharingPage.steps.1":
        "Share in 1 click. A personal link is automatically generated with each share.",
    "sdk.sharingPage.steps.2":
        "Earn on every purchase. Every order placed through your link earns you cash.",
    "sdk.sharingPage.steps.3":
        "Collect your earnings in the app. Install FRAK to collect your earnings.",
    "sharing.btn.share": "Share",
    "sharing.btn.copy": "Copy link",
    "sdk.sharingPage.confirmation.title":
        "Thank you for sharing!\nDon't miss out on your {{ estimatedReward }}.",
    "sdk.sharingPage.confirmation.subtitle":
        "Install the Frak app, official partner of {{ productName }}, and track your earnings in real time.",
    "sdk.sharingPage.confirmation.cardPopupTitle":
        "You just won {{ estimatedReward }}! 🎉",
    "sdk.sharingPage.confirmation.cardPopupDescription":
        "A purchase was made through your link. {{ estimatedReward }} has been transferred to your wallet.",
    "sdk.sharingPage.confirmation.benefits.wallet.title":
        "Your wallet secured in 10 seconds",
    "sdk.sharingPage.confirmation.benefits.wallet.description":
        "No email, no password, no form. Simple, fast and secure.",
    "sdk.sharingPage.confirmation.benefits.notify.title":
        "Get notified as soon as you earn",
    "sdk.sharingPage.confirmation.benefits.notify.description":
        "Receive a notification when a purchase is made thanks to you.",
    "sdk.sharingPage.confirmation.benefits.cashout.title":
        "Cash out whenever you want",
    "sdk.sharingPage.confirmation.benefits.cashout.description":
        "Transfer your earnings directly to your bank account in 3 clicks.",
    "sdk.sharingPage.confirmation.cta": "Collect my {{ estimatedReward }}",
    "sdk.sharingPage.confirmation.shareAgain": "Share again",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
    usd: "$",
    eur: "€",
    gbp: "£",
};

/**
 * Get preview context (currency + shop name) from root loader
 */
function usePreviewContext() {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const currency = (rootData?.shop?.preferredCurrency ?? "usd") as Currency;
    const shopName = rootData?.shop?.name ?? "My Store";
    return { currency, shopName };
}

/**
 * Build a translation function that resolves from custom values → defaults,
 * then substitutes {{ estimatedReward }} and {{ productName }}.
 */
function makePreviewT(
    values: Record<string, string>,
    currency: Currency,
    shopName: string
) {
    const symbol = CURRENCY_SYMBOLS[currency] ?? "$";
    const estimatedReward = `5,00 ${symbol}`;

    return (key: string) => {
        const raw = values[key] || PREVIEW_DEFAULTS[key] || key;
        return raw
            .replace(/\{\{\s*estimatedReward\s*\}\}/g, estimatedReward)
            .replace(/\{\{\s*productName\s*\}\}/g, shopName);
    };
}

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
                                    onUpdate(key, e.currentTarget.value ?? "")
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
                                    onUpdate(key, e.currentTarget.value ?? "")
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
    logoUrl,
}: {
    values: Record<string, string>;
    onUpdate: (key: string, value: string) => void;
    language: string;
    logoUrl?: string;
}){
    const { t } = useTranslation();
    const { currency, shopName } = usePreviewContext();
    const previewT = makePreviewT(values, currency, shopName);

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
                                onUpdate(key, e.currentTarget.value ?? "")
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
                <s-section>
                    <s-stack gap="base">
                        <div>
                            <s-heading>
                                {t("customizations.preview.sharingPage.title")}
                            </s-heading>
                            <s-text tone="neutral">
                                {t(
                                    "customizations.preview.sharingPage.description"
                                )}
                            </s-text>
                        </div>
                        <SharingPreview t={previewT} logoUrl={logoUrl} />
                    </s-stack>
                </s-section>
                <s-section>
                    <s-stack gap="base">
                        <div>
                            <s-heading>
                                {t("customizations.preview.confirmation.title")}
                            </s-heading>
                            <s-text tone="neutral">
                                {t(
                                    "customizations.preview.confirmation.description"
                                )}
                            </s-text>
                        </div>
                        <SharingSuccessPreview t={previewT} logoUrl={logoUrl} />
                    </s-stack>
                </s-section>
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

/**
 * Handle the value of the field.
 * If the value is not empty, return the value.
 * If the value is empty, return the default value.
 */
function handleValue(value: string, defaultValue: string) {
    if (value && value !== "") {
        return value;
    }
    return defaultValue;
}
