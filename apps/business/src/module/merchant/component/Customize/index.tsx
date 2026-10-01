import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { pageBottomSpacer } from "@/module/common/component/FloatingFooter/floating-footer.css";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { EditPageLayout } from "@/module/merchant/component/EditPageLayout";
import { MerchantDetailsCard } from "@/module/merchant/component/MerchantDetailsCard";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { useSdkConfig } from "@/module/merchant/hook/useSdkConfig";
import { useSectionedSave } from "@/module/merchant/hook/useSectionedSave";
import { merchantSdkConfigQueryKey } from "@/module/merchant/queries/queryKeys";
import { CustomizeSaveProvider } from "../saveRegistry";
import { AmbassadorPagePanel } from "./AmbassadorPagePanel";
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
    const queryClient = useQueryClient();
    const isDemoMode = useIsDemoMode();
    const { data: merchant, isPending: isMerchantPending } = useMerchant({
        merchantId,
    });
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

    const { mutateAsync: createPlacement, isPending: isCreatingPlacement } =
        useMerchantUpdate({ merchantId, target: "sdk-config" });

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
            const placements = {
                ...(sdkConfig.placements ?? {}),
                [placementId]: {},
            };
            await createPlacement({ placements });
            // The invalidation refetch lands later; until then the new placement is not selectable.
            queryClient.setQueryData<typeof sdkConfigData>(
                merchantSdkConfigQueryKey(merchantId, isDemoMode),
                (current) =>
                    current && {
                        ...current,
                        sdkConfig: { ...current.sdkConfig, placements },
                    }
            );
            handleTabChange(placementId);
        },
        [
            createPlacement,
            sdkConfig.placements,
            handleTabChange,
            queryClient,
            merchantId,
            isDemoMode,
        ]
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

    if (!sdkConfigData || isMerchantPending) {
        return (
            <EditPageLayout merchantId={merchantId} page="customize">
                <Spinner />
            </EditPageLayout>
        );
    }

    const shopName = sdkConfig.name || merchant?.name || "My Store";
    // The selector lives in the placement's card: never select a placement the config does not hold yet.
    const selectedTab = placementIds.includes(activeTab)
        ? activeTab
        : "default";
    const placementSelector = (
        <PlacementSelector
            activeTab={selectedTab}
            placementIds={placementIds}
            onTabChange={handleTabChange}
            onCreatePlacement={handleCreatePlacement}
            isCreatingPlacement={isCreatingPlacement}
        />
    );

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

                    <SharingWordingPanel
                        merchantId={merchantId}
                        sdkConfig={sdkConfig}
                        shopName={shopName}
                    />

                    <AmbassadorPagePanel
                        merchantId={merchantId}
                        sdkConfig={sdkConfig}
                        shopName={shopName}
                        explorerHeroImageUrl={
                            merchant?.explorerConfig?.heroImageUrl
                        }
                    />

                    {selectedTab === "default" ? (
                        <DefaultCustomization
                            merchantId={merchantId}
                            sdkConfig={sdkConfig}
                            shopName={shopName}
                            placementSelector={placementSelector}
                        />
                    ) : (
                        <PlacementCustomization
                            merchantId={merchantId}
                            placementId={selectedTab}
                            sdkConfig={sdkConfig}
                            shopName={shopName}
                            placementSelector={placementSelector}
                            onDelete={() => setActiveTab("default")}
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
