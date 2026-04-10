import { BannerTab } from "app/components/Appearance/BannerTab";
import { ButtonTab } from "app/components/Appearance/ButtonTab";
import { CheckoutExtensionTab } from "app/components/Appearance/CheckoutExtensionTab";
import { CustomizationsTab } from "app/components/Appearance/CustomizationsTab";
import { PageHeading } from "app/components/ui/PageHeading";
import { Tabs } from "app/components/ui/Tabs";
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
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, useLoaderData } from "react-router";

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
    ] = await Promise.all([
        getI18nCustomizations(context),
        getAppearanceMetafield(context),
        doesThemeHasFrakButton(context),
        doesThemeHasFrakBanner(context),
        firstProductPublished(context),
        getMainThemeId(context),
    ]);

    return data({
        customizations,
        appearanceMetafield,
        isThemeHasFrakButton,
        isThemeHasFrakBanner,
        firstProduct,
        themeId: theme.id,
    });
};

export async function action({ request }: ActionFunctionArgs) {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

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
    } = useLoaderData<typeof loader>();
    const { t } = useTranslation();
    const [selectedTab, setSelectedTab] = useState(0);

    const tabs = [
        {
            id: "customizations",
            content: t("appearance.tabs.customizations"),
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

    const renderTabContent = () => {
        switch (selectedTab) {
            case 0:
                return (
                    <CustomizationsTab
                        initialCustomizations={customizations}
                        initialAppearanceMetafield={appearanceMetafield}
                    />
                );
            case 1:
                return (
                    <ButtonTab
                        isThemeHasFrakButton={isThemeHasFrakButton}
                        firstProduct={firstProduct}
                    />
                );
            case 2:
                return (
                    <BannerTab isThemeHasFrakBanner={isThemeHasFrakBanner} />
                );
            case 3:
                return <CheckoutExtensionTab />;
            default:
                return null;
        }
    };

    return (
        <s-page heading={t("appearance.title")}>
            <PageHeading>{t("appearance.title")}</PageHeading>
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
                {renderTabContent()}
            </Tabs>
        </s-page>
    );
}
