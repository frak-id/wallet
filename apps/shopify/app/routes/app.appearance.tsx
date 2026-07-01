import { BannerTab } from "app/components/Appearance/BannerTab";
import { ButtonTab } from "app/components/Appearance/ButtonTab";
import { CheckoutExtensionTab } from "app/components/Appearance/CheckoutExtensionTab";
import { CustomizationsTab } from "app/components/Appearance/CustomizationsTab";
import { ExplorerTab } from "app/components/Appearance/ExplorerTab";
import { ManualBannerInstall } from "app/components/Appearance/ManualBannerInstall";
import { ManualButtonInstall } from "app/components/Appearance/ManualButtonInstall";
import { Skeleton } from "app/components/Skeleton";
import { ExternalButton } from "app/components/ui/ExternalLink";
import { PageHeading } from "app/components/ui/PageHeading";
import { Tabs } from "app/components/ui/Tabs";
import {
    deleteMerchantMedia,
    type ExplorerSettings,
    getMerchantExplorerSettings,
    listMerchantMedia,
    updateMerchantExplorerSettings,
    uploadMerchantMedia,
} from "app/services.server/backendMerchant";
import {
    type AppearanceMetafieldValue,
    getAppearanceMetafield,
    getI18nCustomizations,
    type I18nCustomizations,
    updateAppearanceMetafield,
    updateI18nCustomizations,
} from "app/services.server/metafields";
import { firstProductPublished, shopBrandInfo } from "app/services.server/shop";
import {
    doesThemeHasFrakBanner,
    doesThemeHasFrakButton,
    getMainThemeId,
} from "app/services.server/theme";
import { authenticate } from "app/shopify.server";
import { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Await, data, useLoaderData, useRouteLoaderData } from "react-router";
import type { loader as appLoader } from "./app";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);

    // Get all data needed for the appearance tabs
    const [
        customizations,
        appearanceMetafield,
        isThemeHasFrakButton,
        isThemeHasFrakBanner,
        firstProduct,
        theme,
        explorerSettings,
        shopBrand,
        mediaFiles,
    ] = await Promise.all([
        getI18nCustomizations(context).catch((e): I18nCustomizations => {
            console.error("[appearance loader] i18n customizations failed:", e);
            return {};
        }),
        getAppearanceMetafield(context).catch((e): AppearanceMetafieldValue => {
            console.error(
                "[appearance loader] appearance metafield failed:",
                e
            );
            return {};
        }),
        doesThemeHasFrakButton(context).catch((e) => {
            console.error("[appearance loader] button detection failed:", e);
            return false;
        }),
        doesThemeHasFrakBanner(context).catch((e) => {
            console.error("[appearance loader] banner detection failed:", e);
            return false;
        }),
        firstProductPublished(context).catch((e) => {
            console.error("[appearance loader] first product fetch failed:", e);
            return undefined;
        }),
        getMainThemeId(context).catch((e) => {
            console.error("[appearance loader] main theme id failed:", e);
            return { gid: "", id: "" };
        }),
        getMerchantExplorerSettings(context, request).catch((e) => {
            console.error("[appearance loader] explorer settings failed:", e);
            return null;
        }),
        shopBrandInfo(context).catch((e) => {
            console.error("[appearance loader] shop brand info failed:", e);
            return { description: null, logoUrl: null, coverImageUrl: null };
        }),
        listMerchantMedia(context, request).catch((e) => {
            console.error("[appearance loader] media list failed:", e);
            return [];
        }),
    ]);

    return data({
        customizations,
        appearanceMetafield,
        isThemeHasFrakButton,
        isThemeHasFrakBanner,
        firstProduct,
        themeId: theme.id,
        explorerSettings,
        shopBrand,
        mediaFiles,
    });
};

async function handleMediaUpload(
    context: Awaited<ReturnType<typeof authenticate.admin>>,
    request: Request,
    formData: FormData
) {
    const type = formData.get("type") as string;
    const image = formData.get("image") as File;
    if (!type || !image) {
        return data(
            {
                success: false,
                error: "Missing image or type",
                code: "missing_fields",
            },
            { status: 400 }
        );
    }
    const result = await uploadMerchantMedia(context, request, image, type);
    return data(result, { status: result.success ? 200 : 400 });
}

async function handleMediaDelete(
    context: Awaited<ReturnType<typeof authenticate.admin>>,
    request: Request,
    formData: FormData
) {
    const type = formData.get("type") as string;
    if (!type) {
        return data(
            { success: false, message: "Missing type" },
            { status: 400 }
        );
    }
    const result = await deleteMerchantMedia(context, request, type);
    return data(result, { status: result.success ? 200 : 400 });
}

async function handleSaveExplorer(
    context: Awaited<ReturnType<typeof authenticate.admin>>,
    request: Request,
    formData: FormData
) {
    const explorerSettingsData = formData.get("explorerSettings");
    if (!explorerSettingsData) {
        return data(
            { success: false, message: "No explorer data provided" },
            { status: 400 }
        );
    }

    try {
        const settings: ExplorerSettings = JSON.parse(
            explorerSettingsData as string
        );
        const result = await updateMerchantExplorerSettings(
            context,
            request,
            settings
        );
        return data(result, { status: result.success ? 200 : 400 });
    } catch (error) {
        console.error("Error saving explorer settings:", error);
        return data(
            {
                success: false,
                message: "Failed to save explorer settings",
            },
            { status: 500 }
        );
    }
}

export async function action({ request }: ActionFunctionArgs) {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "uploadMedia") {
        return handleMediaUpload(context, request, formData);
    }

    if (intent === "deleteMedia") {
        return handleMediaDelete(context, request, formData);
    }
    if (intent === "saveExplorer") {
        return handleSaveExplorer(context, request, formData);
    }

    if (intent !== "save") {
        return data(
            { success: false, message: "Invalid action" },
            { status: 400 }
        );
    }

    try {
        const customizationsData = formData.get("customizations");
        const appearanceMetafieldData = formData.get("appearanceMetafield");

        if (!customizationsData && !appearanceMetafieldData) {
            return data(
                {
                    success: false,
                    message: "No customizations data provided",
                },
                { status: 400 }
            );
        }

        let success = true;
        const userErrors: string[] = [];

        // Handle i18n customizations
        if (customizationsData) {
            const customizations: I18nCustomizations = JSON.parse(
                customizationsData as string
            );

            const result = await updateI18nCustomizations(
                context,
                customizations
            );
            success = result.success;
            userErrors.push(...result.userErrors.map((e) => e.message));
        }

        // Handle appearance metafield
        if (appearanceMetafieldData) {
            const appearanceMetafield: AppearanceMetafieldValue = JSON.parse(
                appearanceMetafieldData as string
            );

            const result = await updateAppearanceMetafield(
                context,
                appearanceMetafield
            );

            success = success && result.success;
            userErrors.push(...result.userErrors.map((e) => e.message));
        }

        if (success) {
            return data({
                success: true,
                message: "Customizations saved successfully!",
            });
        }

        return data(
            {
                success: false,
                message: `Error saving customizations: ${userErrors.join(", ")}`,
            },
            { status: 400 }
        );
    } catch (error) {
        console.error("Error in customizations action:", error);
        return data(
            {
                success: false,
                message: "An error occurred while saving customizations",
            },
            { status: 500 }
        );
    }
}

export default function AppearancePage() {
    const {
        customizations,
        appearanceMetafield,
        isThemeHasFrakButton,
        isThemeHasFrakBanner,
        firstProduct,
        explorerSettings,
        shopBrand,
        mediaFiles,
    } = useLoaderData<typeof loader>();
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    const shopName = rootData?.shop?.name ?? "My Store";
    const businessUrl = rootData?.businessUrl ?? "";
    const merchantId = rootData?.merchantId;
    const shopDomain = rootData?.shop?.myshopifyDomain;
    // Deep-link the legacy "Open editor" straight to the branding editor, same
    // as the dashboard's manual-install step 3.
    const customizeUrl = merchantId
        ? `${businessUrl}/m/${merchantId}/merchant/customize`
        : businessUrl;
    // Deep-links for the manual (non-app-block) button/banner install.
    const themeBase = `https://${shopDomain}/admin/themes/current`;
    const productTemplateUrl = `${themeBase}?key=templates/product.liquid`;
    const themeLiquidUrl = `${themeBase}?key=layout/theme.liquid`;
    const isThemeSupportedPromise = rootData?.isThemeSupportedPromise;
    const { t } = useTranslation();
    const [selectedTab, setSelectedTab] = useState(0);

    const fullTabs = [
        {
            id: "customizations",
            content: t("appearance.tabs.customizations"),
        },
        {
            id: "explorer",
            content: t("appearance.tabs.explorer"),
        },
        {
            id: "share-button",
            content: t("appearance.tabs.shareButton"),
        },
        {
            id: "banner",
            content: t("appearance.tabs.banner"),
        },
        {
            id: "checkout-extension",
            content: t("appearance.tabs.checkoutExtension"),
        },
    ];

    // Single renderer keyed on the tab id. Every theme sees all tabs; the
    // Customizations / Share Button / Banner tabs swap to a manual (copy-paste
    // + redirect) view when the theme can't host in-page app blocks.
    const renderTabContent = (isThemeSupported: boolean) => {
        switch (fullTabs[selectedTab]?.id) {
            case "customizations":
                return isThemeSupported ? (
                    <CustomizationsTab
                        initialCustomizations={customizations}
                        initialAppearanceMetafield={appearanceMetafield}
                        mediaFiles={mediaFiles}
                    />
                ) : (
                    <s-section>
                        <s-stack gap="base">
                            <s-banner tone="info">
                                <s-text>
                                    {t("appearance.legacy.customizationsNote")}
                                </s-text>
                            </s-banner>
                            <ExternalButton
                                variant="primary"
                                href={customizeUrl}
                            >
                                {t("appearance.legacy.openEditor")}
                            </ExternalButton>
                        </s-stack>
                    </s-section>
                );
            case "explorer":
                return (
                    <ExplorerTab
                        initialExplorerSettings={explorerSettings}
                        shopBrand={shopBrand}
                        sdkLogoUrl={appearanceMetafield.logoUrl || ""}
                        shopName={shopName}
                        mediaFiles={mediaFiles}
                    />
                );
            case "share-button":
                return isThemeSupported ? (
                    <ButtonTab
                        isThemeHasFrakButton={isThemeHasFrakButton}
                        firstProduct={firstProduct}
                    />
                ) : (
                    <ManualButtonInstall
                        productTemplateUrl={productTemplateUrl}
                        customizeUrl={customizeUrl}
                    />
                );
            case "banner":
                return isThemeSupported ? (
                    <BannerTab isThemeHasFrakBanner={isThemeHasFrakBanner} />
                ) : (
                    <ManualBannerInstall
                        themeLiquidUrl={themeLiquidUrl}
                        customizeUrl={customizeUrl}
                    />
                );
            case "checkout-extension":
                return <CheckoutExtensionTab />;
            default:
                return null;
        }
    };

    return (
        <s-page heading={t("appearance.title")}>
            <PageHeading>{t("appearance.title")}</PageHeading>
            <Suspense fallback={<Skeleton />}>
                <Await resolve={isThemeSupportedPromise}>
                    {(isThemeSupported) => {
                        const supported = isThemeSupported ?? true;
                        return (
                            <Tabs
                                tabs={fullTabs}
                                selected={selectedTab}
                                onSelect={setSelectedTab}
                            >
                                {renderTabContent(supported)}
                            </Tabs>
                        );
                    }}
                </Await>
            </Suspense>
        </s-page>
    );
}
