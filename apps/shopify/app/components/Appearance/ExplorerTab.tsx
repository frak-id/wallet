import type { action } from "app/routes/app.appearance";
import type { ExplorerSettings } from "app/services.server/backendMerchant";
import type { ShopBrandInfo } from "app/services.server/shop";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Form, useFetcher, useNavigation } from "react-router";

type ExplorerTabProps = {
    initialExplorerSettings: ExplorerSettings | null;
    shopBrand: ShopBrandInfo;
    sdkLogoUrl: string;
};

export function ExplorerTab({
    initialExplorerSettings,
    shopBrand,
    sdkLogoUrl,
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

    const isPreFilled = useMemo(
        () =>
            !initialExplorerSettings &&
            (shopBrand.logoUrl ||
                shopBrand.coverImageUrl ||
                shopBrand.description ||
                sdkLogoUrl),
        [initialExplorerSettings, shopBrand, sdkLogoUrl]
    );

    useEffect(() => {
        if (!fetcher.data?.success) return;
        shopify.toast.show(fetcher.data.message);
    }, [fetcher.data]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.target as HTMLFormElement);
        fetcher.submit(formData, {
            method: "post",
            action: "/app/appearance",
        });
    };

    return (
        <s-stack gap="large">
            <s-section>
                <s-stack gap="base">
                    <s-box paddingBlockStart="small" paddingBlockEnd="small">
                        <s-badge tone="info">
                            {t("appearance.explorer.badge")}
                        </s-badge>
                    </s-box>
                    <s-text>{t("appearance.explorer.description")}</s-text>
                </s-stack>
            </s-section>

            {isPreFilled ? (
                <s-section>
                    <s-box paddingBlockStart="small" paddingBlockEnd="small">
                        <s-badge tone="info">
                            {t("appearance.explorer.preFilled")}
                        </s-badge>
                    </s-box>
                </s-section>
            ) : null}

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

                <s-stack gap="base">
                    <s-section>
                        <s-stack gap="large">
                            <s-checkbox
                                label={t("appearance.explorer.enabledLabel")}
                                checked={enabled || undefined}
                                onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>
                                ) => setEnabled(e.currentTarget.checked)}
                            />

                            <s-text-field
                                label={t("appearance.explorer.logoLabel")}
                                placeholder="https://..."
                                value={logoUrl}
                                onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>
                                ) => setLogoUrl(e.currentTarget.value)}
                                autocomplete="off"
                            />

                            <s-text-field
                                label={t("appearance.explorer.heroLabel")}
                                placeholder="https://..."
                                value={heroImageUrl}
                                onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>
                                ) => setHeroImageUrl(e.currentTarget.value)}
                                autocomplete="off"
                            />

                            <s-text-area
                                label={t(
                                    "appearance.explorer.descriptionLabel"
                                )}
                                placeholder={t(
                                    "appearance.explorer.descriptionPlaceholder"
                                )}
                                value={description}
                                onChange={(
                                    e: React.ChangeEvent<HTMLTextAreaElement>
                                ) => setDescription(e.currentTarget.value)}
                                autocomplete="off"
                            />
                        </s-stack>
                    </s-section>

                    <s-box paddingBlockEnd="base">
                        <s-button
                            type="submit"
                            loading={isLoading || undefined}
                            disabled={
                                (!hasChanges && !isPreFilled) || undefined
                            }
                        >
                            {t("appearance.explorer.save")}
                        </s-button>
                    </s-box>
                </s-stack>
            </Form>
        </s-stack>
    );
}
