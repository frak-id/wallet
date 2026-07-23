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
import { log } from "app/services.server/logger";
import {
    type AppearanceMetafieldValue,
    getAppearanceMetafield,
    getI18nCustomizations,
    type I18nCustomizations,
    updateAppearanceMetafield,
    updateI18nCustomizations,
} from "app/services.server/metafields";
import { firstProductPublished } from "app/services.server/shop";
import {
    doesThemeHasFrakBanner,
    doesThemeHasFrakButton,
    getMainThemeId,
} from "app/services.server/theme";
import { authenticate } from "app/shopify.server";
import { urlToMediaType } from "app/utils/mediaUrl";
import { buildBusinessDashboardUrl } from "app/utils/url";
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
        mediaFiles,
    ] = await Promise.all([
        getI18nCustomizations(context).catch((e): I18nCustomizations => {
            log.error(
                { err: e },
                "appearance loader: i18n customizations failed"
            );
            return {};
        }),
        getAppearanceMetafield(context).catch((e): AppearanceMetafieldValue => {
            log.error(
                { err: e },
                "appearance loader: appearance metafield failed"
            );
            return {};
        }),
        doesThemeHasFrakButton(context).catch((e) => {
            log.error({ err: e }, "appearance loader: button detection failed");
            return false;
        }),
        doesThemeHasFrakBanner(context).catch((e) => {
            log.error({ err: e }, "appearance loader: banner detection failed");
            return false;
        }),
        firstProductPublished(context).catch((e) => {
            log.error(
                { err: e },
                "appearance loader: first product fetch failed"
            );
            return undefined;
        }),
        getMainThemeId(context).catch((e) => {
            log.error({ err: e }, "appearance loader: main theme id failed");
            return { gid: "", id: "" };
        }),
        getMerchantExplorerSettings(context, request).catch((e) => {
            log.error(
                { err: e },
                "appearance loader: explorer settings failed"
            );
            return null;
        }),
        listMerchantMedia(context, request).catch((e) => {
            log.error({ err: e }, "appearance loader: media list failed");
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

// Deletion replay must skip any media type still referenced by the settings
// being saved — e.g. the main hero field and a hero-extra can share the same
// file, so removing the extra must not delete it. The logo is a single shared
// file used by both the Explorer and Customizations forms, and a per-form save
// can't see the other form's state, so it is never auto-deleted (worst case: a
// benign orphan on replacement).
const SHARED_MEDIA_TYPES = ["logo"];

function stillReferencedTypes(settings: ExplorerSettings): Set<string> {
    const referenced = new Set<string>(SHARED_MEDIA_TYPES);
    for (const url of [settings.logoUrl, settings.heroImageUrl].filter(
        Boolean
    )) {
        const type = urlToMediaType(url);
        if (type) referenced.add(type);
    }
    for (const url of settings.heroImageUrls) {
        const type = urlToMediaType(url);
        if (type) referenced.add(type);
    }
    return referenced;
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

        // Commit the listing first; only replay deferred deletions once the
        // new references are persisted, so a listing-save failure can't leave
        // a still-referenced file already deleted (worst case is a benign
        // orphan, the same class as the accepted upload-then-discard orphan).
        const result = await updateMerchantExplorerSettings(
            context,
            request,
            settings
        );
        if (!result.success) {
            return data(result, { status: 400 });
        }

        // Leave pending state intact on any replay failure so the merchant can
        // retry rather than losing the unsaved changes (Risks: partial failure).
        const replayResult = await replayFormDeletions(
            context,
            request,
            formData,
            stillReferencedTypes(settings)
        );
        if (!replayResult.success) {
            return data(replayResult, { status: 500 });
        }

        return data(result, { status: 200 });
    } catch (error) {
        log.error({ err: error }, "Error saving explorer settings");
        return data(
            {
                success: false,
                message: "Failed to save explorer settings",
            },
            { status: 500 }
        );
    }
}

async function replayDeferredDeletions(
    context: Awaited<ReturnType<typeof authenticate.admin>>,
    request: Request,
    deletedTypes: string[],
    stillReferenced: Set<string>
): Promise<{ success: true } | { success: false; message: string }> {
    for (const type of deletedTypes) {
        if (stillReferenced.has(type)) continue;
        const deleteResult = await deleteMerchantMedia(context, request, type);
        if (!deleteResult.success) {
            log.error({ type }, "Failed to replay deferred media deletion");
            return {
                success: false,
                message: "Failed to remove one or more images",
            };
        }
    }
    return { success: true };
}

// Replay any deferred deletions recorded on the form, skipping types still
// referenced by the just-saved state. No-op when the form carried none.
async function replayFormDeletions(
    context: Awaited<ReturnType<typeof authenticate.admin>>,
    request: Request,
    formData: FormData,
    stillReferenced: Set<string>
): Promise<{ success: true } | { success: false; message: string }> {
    const deletedMediaTypesData = formData.get("deletedMediaTypes");
    if (!deletedMediaTypesData) {
        return { success: true };
    }
    const deletedTypes: string[] = JSON.parse(deletedMediaTypesData as string);
    return replayDeferredDeletions(
        context,
        request,
        deletedTypes,
        stillReferenced
    );
}

// The customizations form only manages the logo, so the sole still-referenced
// type is whatever the saved metafield logo URL resolves to (if any).
function customizationsStillReferenced(
    appearanceMetafieldData: FormDataEntryValue | null
): Set<string> {
    const referenced = new Set<string>(SHARED_MEDIA_TYPES);
    if (!appearanceMetafieldData) {
        return referenced;
    }
    const preview: AppearanceMetafieldValue = JSON.parse(
        appearanceMetafieldData as string
    );
    const type = preview.logoUrl ? urlToMediaType(preview.logoUrl) : null;
    if (type) referenced.add(type);
    return referenced;
}

async function handleSaveCustomizations(
    context: Awaited<ReturnType<typeof authenticate.admin>>,
    request: Request,
    formData: FormData
) {
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
            // Replay deferred deletions only after the metafield commit
            // succeeded, so a failed save can't leave a still-referenced file
            // already deleted (worst case: benign orphan).
            const replayResult = await replayFormDeletions(
                context,
                request,
                formData,
                customizationsStillReferenced(appearanceMetafieldData)
            );
            if (!replayResult.success) {
                return data(replayResult, { status: 500 });
            }
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
        log.error({ err: error }, "Error in customizations action");
        return data(
            {
                success: false,
                message: "An error occurred while saving customizations",
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

    if (intent === "saveExplorer") {
        return handleSaveExplorer(context, request, formData);
    }
    if (intent === "save") {
        return handleSaveCustomizations(context, request, formData);
    }

    return data({ success: false, message: "Invalid action" }, { status: 400 });
}

export default function AppearancePage() {
    const {
        customizations,
        appearanceMetafield,
        isThemeHasFrakButton,
        isThemeHasFrakBanner,
        firstProduct,
        explorerSettings,
        mediaFiles,
    } = useLoaderData<typeof loader>();
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    const shopName = rootData?.shop?.name ?? "My Store";
    const businessUrl = rootData?.businessUrl ?? "";
    const merchantId = rootData?.merchantId;
    const shopDomain = rootData?.shop?.myshopifyDomain;
    // Deep-link the legacy "Open editor" straight to the branding editor, same
    // as the dashboard's manual-install step 3. Routed through the Shopify SSO
    // login entrypoint so the merchant doesn't have to manually re-authenticate
    // in the business app.
    const customizeUrl = buildBusinessDashboardUrl({
        businessUrl,
        shop: shopDomain,
        // No merchant-scoped customize route exists without an id, so fall
        // back to the dashboard (business resolves the user's first merchant)
        // rather than a non-existent `/merchant/customize` path.
        target: merchantId
            ? `/m/${merchantId}/merchant/customize`
            : "/dashboard",
    });
    // Deep-links for the manual (non-app-block) button/banner install.
    const themeBase = `https://${shopDomain}/admin/themes/current`;
    const productTemplateUrl = `${themeBase}?key=templates/product.liquid`;
    const themeLiquidUrl = `${themeBase}?key=layout/theme.liquid`;
    const isThemeSupportedPromise = rootData?.isThemeSupportedPromise;
    const { t } = useTranslation();
    const [selectedTab, setSelectedTab] = useState(0);

    // Both forms defer save via the native Save Bar, but they sit behind this
    // local tab switch rather than a route change, so App Bridge's
    // leave-confirmation (navigation-only) never fires here. Track each form's
    // dirty state and block the tab switch while either is dirty.
    const [isCustomizationsDirty, setIsCustomizationsDirty] = useState(false);
    const [isExplorerDirty, setIsExplorerDirty] = useState(false);
    const isAnyFormDirty = isCustomizationsDirty || isExplorerDirty;

    const handleTabSelect = async (index: number) => {
        // Native leave-confirmation for the active save bar — window.confirm
        // is unreliable inside the embedded admin iframe (Chrome can suppress
        // it). Resolves when it's safe to leave (nothing dirty, or the
        // merchant discarded); rejects when they choose to stay.
        if (isAnyFormDirty) {
            try {
                await shopify.saveBar.leaveConfirmation();
            } catch {
                return;
            }
        }
        // The leaving form unmounts without re-reporting its dirty state, so
        // clear both flags here; the newly shown form re-reports on mount.
        setIsCustomizationsDirty(false);
        setIsExplorerDirty(false);
        setSelectedTab(index);
    };

    // Two conceptual buckets: what shows up on the merchant's storefront
    // (button, banner, checkout extension, and the text shown to shoppers in
    // Frak modals), vs. what lives in the Frak app itself (the Explorer
    // wallet-listing preview).
    const groupTabs = [
        {
            id: "on-your-site",
            content: t("appearance.tabs.onYourSite"),
        },
        {
            id: "in-frak-app",
            content: t("appearance.tabs.inFrakApp"),
        },
    ];

    // Every theme sees all storefront sections; the Customizations / Share
    // Button / Banner sections each swap to a manual (copy-paste + redirect)
    // view when the theme can't host in-page app blocks.
    const renderOnYourSite = (isThemeSupported: boolean) => (
        <s-stack gap="large">
            <s-section heading={t("appearance.tabs.customizations")}>
                {isThemeSupported ? (
                    <CustomizationsTab
                        initialCustomizations={customizations}
                        initialAppearanceMetafield={appearanceMetafield}
                        mediaFiles={mediaFiles}
                        onDirtyChange={setIsCustomizationsDirty}
                    />
                ) : (
                    <s-stack gap="base">
                        <s-banner tone="info">
                            <s-text>
                                {t("appearance.legacy.customizationsNote")}
                            </s-text>
                        </s-banner>
                        <ExternalButton variant="primary" href={customizeUrl}>
                            {t("appearance.legacy.openEditor")}
                        </ExternalButton>
                    </s-stack>
                )}
            </s-section>

            <s-section heading={t("appearance.tabs.shareButton")}>
                {isThemeSupported ? (
                    <ButtonTab
                        isThemeHasFrakButton={isThemeHasFrakButton}
                        firstProduct={firstProduct}
                    />
                ) : (
                    <ManualButtonInstall
                        productTemplateUrl={productTemplateUrl}
                        customizeUrl={customizeUrl}
                    />
                )}
            </s-section>

            <s-section heading={t("appearance.tabs.banner")}>
                {isThemeSupported ? (
                    <BannerTab isThemeHasFrakBanner={isThemeHasFrakBanner} />
                ) : (
                    <ManualBannerInstall
                        themeLiquidUrl={themeLiquidUrl}
                        customizeUrl={customizeUrl}
                    />
                )}
            </s-section>

            <s-section heading={t("appearance.tabs.checkoutExtension")}>
                <CheckoutExtensionTab />
            </s-section>
        </s-stack>
    );

    const renderInFrakApp = () => (
        <ExplorerTab
            initialExplorerSettings={explorerSettings}
            shopName={shopName}
            mediaFiles={mediaFiles}
            onDirtyChange={setIsExplorerDirty}
        />
    );

    return (
        <s-page heading={t("appearance.title")}>
            <PageHeading>{t("appearance.title")}</PageHeading>
            <Suspense fallback={<Skeleton />}>
                <Await resolve={isThemeSupportedPromise}>
                    {(isThemeSupported) => {
                        const supported = isThemeSupported ?? true;
                        return (
                            <Tabs
                                tabs={groupTabs}
                                selected={selectedTab}
                                onSelect={handleTabSelect}
                            >
                                {groupTabs[selectedTab]?.id === "on-your-site"
                                    ? renderOnYourSite(supported)
                                    : renderInFrakApp()}
                            </Tabs>
                        );
                    }}
                </Await>
            </Suspense>
        </s-page>
    );
}
