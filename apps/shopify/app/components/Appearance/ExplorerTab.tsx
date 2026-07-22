import { isValidUrl } from "@frak-labs/app-essentials";
import { ExplorerPhonePreview, previewWrap } from "@frak-labs/ui-preview";
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
import * as styles from "./ExplorerTab.css";
import { ImageUploadField } from "./ImageUploadField";
import { MultiHeroImagesField } from "./MultiHeroImagesField";

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
            heroImageUrls: initialExplorerSettings?.heroImageUrls ?? [],
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
    const [heroImageUrls, setHeroImageUrls] = useState(defaults.heroImageUrls);
    const [description, setDescription] = useState(defaults.description);

    const isLoading = navigation.state === "submitting";

    const hasChanges = useMemo(
        () =>
            enabled !== defaults.enabled ||
            logoUrl !== defaults.logoUrl ||
            heroImageUrl !== defaults.heroImageUrl ||
            heroImageUrls.join(",") !== defaults.heroImageUrls.join(",") ||
            description !== defaults.description,
        [enabled, logoUrl, heroImageUrl, heroImageUrls, description, defaults]
    );

    // Block persistence of a manually-typed invalid URL (empty is allowed).
    const hasValidUrls = isValidUrl(logoUrl) && isValidUrl(heroImageUrl);

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
        // Implicit submit (Enter in a text field) bypasses the disabled Save
        // button, so gate the explicit submit path on URL validity too.
        if (!hasValidUrls) {
            shopify.toast.show(t("appearance.explorer.invalidUrlToast"), {
                isError: true,
            });
            return;
        }
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
                heroImageUrls,
                description,
                ...overrides,
            };
            // Never persist a manually-typed invalid URL through a sibling
            // autosave trigger (hero-extras). Empty is allowed; the invalid
            // field already shows an inline error, so surface a toast too.
            if (
                !isValidUrl(settings.logoUrl) ||
                !isValidUrl(settings.heroImageUrl)
            ) {
                shopify.toast.show(t("appearance.explorer.invalidUrlToast"), {
                    isError: true,
                });
                return;
            }
            fetcher.submit(
                {
                    intent: "saveExplorer",
                    explorerSettings: JSON.stringify(settings),
                },
                { method: "post", action: "/app/appearance" }
            );
        },
        [enabled, logoUrl, heroImageUrl, heroImageUrls, description, fetcher, t]
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
        <Form onSubmit={handleSubmit} className={styles.form}>
            <input type="hidden" name="intent" value="saveExplorer" />
            <input
                type="hidden"
                name="explorerSettings"
                value={JSON.stringify({
                    enabled,
                    logoUrl,
                    heroImageUrl,
                    heroImageUrls,
                    description,
                })}
            />

            <div className={styles.formCol}>
                <s-section>
                    <s-stack gap="large">
                        <s-text>{t("appearance.explorer.description")}</s-text>

                        <s-switch
                            label={t("appearance.explorer.enabledLabel")}
                            details={t("appearance.explorer.enabledHint")}
                            checked={enabled || undefined}
                            onChange={(e) => {
                                const next = e.currentTarget.checked ?? false;
                                // Block the toggle while a URL is invalid so the
                                // switch doesn't flip "on" without persisting.
                                if (!hasValidUrls) {
                                    shopify.toast.show(
                                        t(
                                            "appearance.explorer.invalidUrlToast"
                                        ),
                                        { isError: true }
                                    );
                                    return;
                                }
                                setEnabled(next);
                                autoSave({ enabled: next });
                            }}
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

                        <MultiHeroImagesField
                            label={t("appearance.explorer.heroExtrasLabel")}
                            values={heroImageUrls}
                            onChange={(next) => {
                                setHeroImageUrls(next);
                                autoSave({ heroImageUrls: next });
                            }}
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
                            disabled={!hasChanges || !hasValidUrls || undefined}
                        >
                            {t("appearance.explorer.save")}
                        </s-button>
                    </s-stack>
                </s-section>
            </div>

            {/* Phone preview column — a flex sibling of the form so Polaris
                re-centring can't make it overlap the card. Dimmed + shrunk
                while the explorer listing is disabled. */}
            <div className={styles.preview}>
                <div
                    className={previewWrap}
                    data-disabled={enabled ? undefined : ""}
                >
                    <ExplorerPhonePreview
                        name={shopName}
                        heroImageUrl={heroImageUrl || undefined}
                        heroImageUrls={heroImageUrls}
                        logoUrl={logoUrl || undefined}
                        description={description || undefined}
                    />
                </div>
            </div>
        </Form>
    );
}
