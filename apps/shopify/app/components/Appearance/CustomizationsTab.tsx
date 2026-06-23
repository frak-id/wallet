import type { action } from "app/routes/app.appearance";
import type { MediaFile } from "app/services.server/backendMerchant";
import type {
    AppearanceMetafieldValue,
    I18nCustomizations,
} from "app/services.server/metafields";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Form, useFetcher, useNavigation } from "react-router";
import { LogoField } from "../Customizations/Field";

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

    const [appearanceMetafield, setAppearanceMetafield] =
        useState<AppearanceMetafieldValue>(initialAppearanceMetafield);

    const isLoading = navigation.state === "submitting";

    useEffect(() => {
        if (!fetcher.data?.success) return;
        if (
            "message" in fetcher.data &&
            typeof fetcher.data.message === "string"
        ) {
            shopify.toast.show(fetcher.data.message);
        }
    }, [fetcher.data]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.target as HTMLFormElement);
        if (!formData) return;
        fetcher.submit(formData, {
            method: "post",
            action: "/app/appearance",
        });
    };

    // Auto-save when a logo is uploaded or cleared. Existing wording overrides
    // are managed by Frak, so they are passed through untouched.
    const handleLogoUploadSuccess = useCallback(
        (url: string) => {
            const newAppearance = { ...appearanceMetafield, logoUrl: url };
            setAppearanceMetafield(newAppearance);
            fetcher.submit(
                {
                    intent: "save",
                    appearanceMetafield: JSON.stringify(newAppearance),
                    customizations: JSON.stringify(initialCustomizations),
                },
                { method: "post", action: "/app/appearance" }
            );
        },
        [appearanceMetafield, initialCustomizations, fetcher]
    );

    return (
        <s-stack gap="large">
            <Form onSubmit={handleSubmit}>
                <input type="hidden" name="intent" value="save" />
                <input
                    type="hidden"
                    name="customizations"
                    value={JSON.stringify(initialCustomizations)}
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
