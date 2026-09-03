import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { Navigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { pageBottomSpacer } from "@/module/common/component/FloatingFooter/floating-footer.css";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { EditPageLayout } from "@/module/merchant/component/EditPageLayout";
import { MerchantDetailsCard } from "@/module/merchant/component/MerchantDetailsCard";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { useSdkConfig } from "@/module/merchant/hook/useSdkConfig";
import { useSectionedSave } from "@/module/merchant/hook/useSectionedSave";
import { CustomizeSaveProvider } from "../saveRegistry";
import { DefaultCustomization } from "./DefaultCustomization";
import { PlacementCustomization } from "./PlacementCustomization";
import { PlacementSelector } from "./PlacementSelector";
import { SaveFooter } from "./SaveFooter";
import { SdkIdentityPanel } from "./SdkIdentityPanel";
import { SharingWordingPanel } from "./SharingWordingPanel";
import { hasDiscardableSectionChanges } from "./sections";
import { getSdkConfig } from "./utils";

export function CustomizePage({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { data: merchant } = useMerchant({ merchantId });
    const { data: sdkConfigData } = useSdkConfig({ merchantId });
    const sdkConfig = useMemo(
        () => getSdkConfig(sdkConfigData?.sdkConfig),
        [sdkConfigData]
    );

    const placements = sdkConfig.placements ?? {};
    const placementIds = Object.keys(placements);

    const [activeTab, setActiveTab] = useState<"default" | string>("default");

    const {
        saveContext,
        dirtySections,
        hasUnsavedChanges,
        isSaving,
        saveError,
        saveAll,
    } = useSectionedSave();

    const {
        mutateAsync: createPlacement,
        isPending: isCreatingPlacement,
        isSuccess: isCreatePlacementSuccess,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });

    const hasUnsavedSectionChanges = useMemo(
        () => hasDiscardableSectionChanges(dirtySections),
        [dirtySections]
    );

    const { guard: guardNavigate, dialogProps: navDialogProps } =
        useDiscardGuard({ isDirty: hasUnsavedChanges });
    const { guard: guardTabChange, dialogProps: tabDialogProps } =
        useDiscardGuard({ isDirty: hasUnsavedSectionChanges });

    const handleTabChange = useCallback(
        (nextTab: "default" | string) => {
            if (nextTab === activeTab) return;
            guardTabChange(() => setActiveTab(nextTab));
        },
        [activeTab, guardTabChange]
    );

    const handleCreatePlacement = useCallback(
        async (placementId: string) => {
            const currentPlacements = sdkConfig.placements ?? {};
            await createPlacement({
                placements: {
                    ...currentPlacements,
                    [placementId]: {},
                },
            });
            setActiveTab(placementId);
        },
        [createPlacement, sdkConfig.placements]
    );

    // Affiliate (e.g. TakeAds) merchants have no SDK to customize — send them
    // to their dedicated affiliate configuration page instead.
    if (merchant?.affiliate) {
        return (
            <Navigate
                to="/m/$merchantId/merchant/affiliate"
                params={{ merchantId }}
                replace
            />
        );
    }

    if (!sdkConfigData) {
        return (
            <EditPageLayout merchantId={merchantId} page="customize">
                <Spinner />
            </EditPageLayout>
        );
    }

    return (
        <CustomizeSaveProvider value={saveContext}>
            <div className={pageBottomSpacer}>
                <EditPageLayout
                    merchantId={merchantId}
                    page="customize"
                    guardNavigate={guardNavigate}
                >
                    <MerchantDetailsCard merchantId={merchantId} />

                    <SdkIdentityPanel
                        merchantId={merchantId}
                        sdkConfig={sdkConfig}
                    />

                    {/* Branded from the render-gated sdkConfig like the sibling
                        panels: `merchant` is a separate in-flight query, and a
                        preset clicked before it resolved persisted brandless copy. */}
                    <SharingWordingPanel
                        merchantId={merchantId}
                        sdkConfig={sdkConfig}
                        shopName={sdkConfig.name ?? "My Store"}
                    />

                    <PlacementSelector
                        activeTab={activeTab}
                        placementIds={placementIds}
                        onTabChange={handleTabChange}
                        onCreatePlacement={handleCreatePlacement}
                        isCreatingPlacement={isCreatingPlacement}
                        isCreatePlacementSuccess={isCreatePlacementSuccess}
                    />

                    {activeTab === "default" ? (
                        <DefaultCustomization
                            merchantId={merchantId}
                            sdkConfig={sdkConfig}
                        />
                    ) : (
                        <PlacementCustomization
                            merchantId={merchantId}
                            placementId={activeTab}
                            sdkConfig={sdkConfig}
                            onSelectDefaultTab={() =>
                                handleTabChange("default")
                            }
                        />
                    )}
                    {saveError && (
                        <Text variant="caption" color="error">
                            {t("merchantEdit.saveError")}
                        </Text>
                    )}
                </EditPageLayout>
            </div>
            <SaveFooter
                disabled={!hasUnsavedChanges}
                isSaving={isSaving}
                onSave={saveAll}
            />
            <DiscardChangesDialog {...navDialogProps} />
            <DiscardChangesDialog {...tabDialogProps} />
        </CustomizeSaveProvider>
    );
}
