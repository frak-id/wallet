import { ExplorerCardPreview } from "@frak-labs/ui-preview";
import type { action } from "app/routes/app.appearance";
import type {
    ExplorerSettings,
    MediaFile,
} from "app/services.server/backendMerchant";
import type { ShopBrandInfo } from "app/services.server/shop";
import {
    type FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Form, useFetcher, useNavigation } from "react-router";
import { ImageUploadField } from "./ImageUploadField";

type ExplorerTabProps = {
    initialExplorerSettings: ExplorerSettings | null;
    shopBrand: ShopBrandInfo;
    sdkLogoUrl: string;
    shopName: string;
    mediaFiles?: MediaFile[];
};

export function ExplorerTab({
    initialExplorerSettings,
    shopBrand,
    sdkLogoUrl,
    shopName,
    mediaFiles,
}: ExplorerTabProps) {
    const fetcher = useFetcher<typeof action>();
    const navigation = useNavigation();
    const { t } = useTranslation();

    const defaults = useMemo(
        () => ({
            enabled: initialExplorerSettings?.enabled ?? false,
            logoUrl:
                initialExplorerSettings?.logoUrl ||
                shopBrand.logoUrl ||
                sdkLogoUrl ||
                "",
            heroImageUrl:
                initialExplorerSettings?.heroImageUrl ||
                shopBrand.coverImageUrl ||
                "",
            description:
                initialExplorerSettings?.description ||
                shopBrand.description ||
                "",
        }),
        [initialExplorerSettings, shopBrand, sdkLogoUrl]
    );

    const [enabled, setEnabled] = useState(defaults.enabled);
    const [logoUrl, setLogoUrl] = useState(defaults.logoUrl);
    const [heroImageUrl, setHeroImageUrl] = useState(defaults.heroImageUrl);
    const [description, setDescription] = useState(defaults.description);

    const isLoading = navigation.state === "submitting";

    const hasChanges = useMemo(
        () =>
            enabled !== defaults.enabled ||
            logoUrl !== defaults.logoUrl ||
            heroImageUrl !== defaults.heroImageUrl ||
            description !== defaults.description,
        [enabled, logoUrl, heroImageUrl, description, defaults]
    );

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
        fetcher.submit(formData, {
            method: "post",
            action: "/app/appearance",
        });
    };

    // Auto-save explorer settings with an override for the changed field
    const autoSave = useCallback(
        (overrides: Partial<ExplorerSettings>) => {
            const settings: ExplorerSettings = {
                enabled,
                logoUrl,
                heroImageUrl,
                description,
                ...overrides,
            };
            fetcher.submit(
                {
                    intent: "saveExplorer",
                    explorerSettings: JSON.stringify(settings),
                },
                { method: "post", action: "/app/appearance" }
            );
        },
        [enabled, logoUrl, heroImageUrl, description, fetcher]
    );

    const handleLogoUploadSuccess = useCallback(
        (url: string) => {
            setLogoUrl(url);
            autoSave({ logoUrl: url });
        },
        [autoSave]
    );

    const handleHeroUploadSuccess = useCallback(
        (url: string) => {
            setHeroImageUrl(url);
            autoSave({ heroImageUrl: url });
        },
        [autoSave]
    );

    return (
        <Form onSubmit={handleSubmit}>
            <input type="hidden" name="intent" value="saveExplorer" />
            <input
                type="hidden"
                name="explorerSettings"
                value={JSON.stringify({
                    enabled,
                    logoUrl,
                    heroImageUrl,
                    description,
                })}
            />

            <s-section>
                <s-stack gap="large">
                    <s-text>{t("appearance.explorer.description")}</s-text>

                    <s-checkbox
                        label={t("appearance.explorer.enabledLabel")}
                        checked={enabled || undefined}
                        onChange={(e) =>
                            setEnabled(e.currentTarget.checked ?? false)
                        }
                    />

                    <ImageUploadField
                        type="logo"
                        value={logoUrl}
                        onChange={setLogoUrl}
                        onUploadSuccess={handleLogoUploadSuccess}
                        label={t("appearance.explorer.logoLabel")}
                        mediaFiles={mediaFiles}
                    />

                    <ImageUploadField
                        type="hero"
                        value={heroImageUrl}
                        onChange={setHeroImageUrl}
                        onUploadSuccess={handleHeroUploadSuccess}
                        label={t("appearance.explorer.heroLabel")}
                        mediaFiles={mediaFiles}
                    />

                    <s-text-area
                        label={t("appearance.explorer.descriptionLabel")}
                        placeholder={t(
                            "appearance.explorer.descriptionPlaceholder"
                        )}
                        value={description}
                        onChange={(e) =>
                            setDescription(e.currentTarget.value ?? "")
                        }
                        autocomplete="off"
                    />

                    <s-button
                        type="submit"
                        loading={isLoading || undefined}
                        disabled={!hasChanges || undefined}
                    >
                        {t("appearance.explorer.save")}
                    </s-button>
                </s-stack>
            </s-section>

            {(logoUrl || heroImageUrl || description) && (
                <s-section>
                    <s-stack gap="base">
                        <s-text font-weight="semibold">
                            {t("appearance.explorer.previewTitle")}
                        </s-text>
                        <s-text tone="subdued">
                            {t("appearance.explorer.previewDescription")}
                        </s-text>
                        <ExplorerCardPreview
                            name={shopName}
                            heroImageUrl={heroImageUrl || undefined}
                            logoUrl={logoUrl || undefined}
                            description={description || undefined}
                        />
                    </s-stack>
                </s-section>
            )}
        </Form>
    );
}
