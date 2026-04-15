import type { action } from "app/routes/app.appearance";
import type { MediaFile } from "app/services.server/backendMerchant";
import type {
    AppearanceMetafieldValue,
    I18nCustomizations,
    MultiLanguageI18nCustomizations,
} from "app/services.server/metafields";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Form, useFetcher, useNavigation } from "react-router";
import {
    LogoField,
    MultiLanguageFields,
    SingleLanguageFields,
} from "../Customizations/Field";
import { LanguageModeSelector } from "../Customizations/LanguageSelector";

type LanguageMode = "single" | "multi";

interface CustomizationsTabProps {
    initialCustomizations: I18nCustomizations;
    initialAppearanceMetafield: AppearanceMetafieldValue;
    mediaFiles?: MediaFile[];
}

export function CustomizationsTab({
    initialCustomizations,
    initialAppearanceMetafield,
    mediaFiles,
}: CustomizationsTabProps) {
    const fetcher = useFetcher<typeof action>();
    const navigation = useNavigation();
    const { t } = useTranslation();

    const [customizations, setCustomizations] = useState<I18nCustomizations>(
        initialCustomizations
    );
    const [appearanceMetafield, setAppearanceMetafield] =
        useState<AppearanceMetafieldValue>(initialAppearanceMetafield);
    const [languageMode, setLanguageMode] = useState<LanguageMode>("single");

    const isLoading = navigation.state === "submitting";

    // Determine initial language mode based on existing data
    useEffect(() => {
        const hasFrench =
            customizations.fr && Object.keys(customizations.fr).length > 0;
        const hasEnglish =
            customizations.en && Object.keys(customizations.en).length > 0;

        if (hasFrench && hasEnglish) {
            setLanguageMode("multi");
        } else {
            setLanguageMode("single");
        }
    }, [customizations.fr, customizations.en]);

    useEffect(() => {
        if (!fetcher.data?.success) return;
        if (
            "message" in fetcher.data &&
            typeof fetcher.data.message === "string"
        ) {
            shopify.toast.show(fetcher.data.message);
        }
    }, [fetcher.data]);

    // Handle single language updates
    const handleSingleLanguageUpdate = (key: string, value: string) => {
        setCustomizations((prev) => {
            const newCustomizations = { ...prev };
            if (!newCustomizations.en) newCustomizations.en = {};
            newCustomizations.en[key] = value;
            return newCustomizations;
        });
    };

    // Handle multi language updates
    const handleMultiLanguageUpdate = (
        language: "fr" | "en",
        key: string,
        value: string
    ) => {
        setCustomizations((prev) => ({
            ...prev,
            [language]: {
                ...(prev[language] as Record<string, string>),
                [key]: value,
            },
        }));
    };

    // Handle language mode change
    const handleLanguageModeChange = (mode: LanguageMode) => {
        setLanguageMode(mode);

        if (mode === "single") {
            // Convert to single language (keep only English)
            const englishData = customizations.en || {};
            setCustomizations(englishData as Record<string, string>);
        }
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.target as HTMLFormElement);
        if (!formData) return;
        fetcher.submit(formData, {
            method: "post",
            action: "/app/appearance",
        });
    };

    // Auto-save when a logo is uploaded or cleared
    const handleLogoUploadSuccess = useCallback(
        (url: string) => {
            const newAppearance = { ...appearanceMetafield, logoUrl: url };
            setAppearanceMetafield(newAppearance);
            fetcher.submit(
                {
                    intent: "save",
                    appearanceMetafield: JSON.stringify(newAppearance),
                    customizations: JSON.stringify(customizations),
                },
                { method: "post", action: "/app/appearance" }
            );
        },
        [appearanceMetafield, customizations, fetcher]
    );

    return (
        <s-stack gap="large">
            <s-section>
                <s-stack gap="base">
                    <s-box paddingBlockStart="small" paddingBlockEnd="small">
                        <s-badge tone="info">
                            {t("customizations.sharingPage.title")}
                        </s-badge>
                    </s-box>
                    <s-text>
                        {t("customizations.sharingPage.description")}
                    </s-text>
                </s-stack>
            </s-section>

            <LanguageModeSelector
                mode={languageMode}
                onModeChange={handleLanguageModeChange}
            />

            <Form onSubmit={handleSubmit}>
                <input type="hidden" name="intent" value="save" />
                <input
                    type="hidden"
                    name="customizations"
                    value={JSON.stringify(customizations)}
                />
                <input
                    type="hidden"
                    name="appearanceMetafield"
                    value={JSON.stringify(appearanceMetafield)}
                />

                <s-stack gap="base">
                    <LogoField
                        logoUrl={appearanceMetafield.logoUrl || ""}
                        onUpdate={(value) =>
                            setAppearanceMetafield({
                                ...appearanceMetafield,
                                logoUrl: value,
                            })
                        }
                        onUploadSuccess={handleLogoUploadSuccess}
                        mediaFiles={mediaFiles}
                    />

                    {languageMode === "single" ? (
                        <SingleLanguageFields
                            customizations={
                                customizations as I18nCustomizations
                            }
                            onUpdate={handleSingleLanguageUpdate}
                            logoUrl={appearanceMetafield.logoUrl}
                        />
                    ) : (
                        <MultiLanguageFields
                            customizations={
                                customizations as MultiLanguageI18nCustomizations
                            }
                            onUpdate={handleMultiLanguageUpdate}
                            logoUrl={appearanceMetafield.logoUrl}
                        />
                    )}
                    <s-box paddingBlockEnd="base">
                        <s-button type="submit" loading={isLoading}>
                            {t("customizations.save")}
                        </s-button>
                    </s-box>
                </s-stack>
            </Form>
        </s-stack>
    );
}
