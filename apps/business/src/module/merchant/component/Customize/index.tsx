import { useCallback, useMemo, useState } from "react";
import { FormLayout } from "@/module/forms/Form";
import { MerchantHead } from "@/module/merchant/component/MerchantHead";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { useSdkConfig } from "@/module/merchant/hook/useSdkConfig";
import { CustomizationTabs } from "./CustomizationTabs";
import { DefaultCustomization } from "./DefaultCustomization";
import { PlacementCustomization } from "./PlacementCustomization";
import { SdkIdentityPanel } from "./SdkIdentityPanel";
import { getSdkConfig } from "./utils";

export function CustomizePage({ merchantId }: { merchantId: string }) {
    const { data: sdkConfigData } = useSdkConfig({ merchantId });
    const sdkConfig = useMemo(
        () => getSdkConfig(sdkConfigData?.sdkConfig),
        [sdkConfigData]
    );

    const placements = sdkConfig.placements ?? {};
    const placementIds = Object.keys(placements);

    const [activeTab, setActiveTab] = useState<"default" | string>("default");
    const [dirtySections, setDirtySections] = useState<Record<string, boolean>>(
        {}
    );

    const {
        mutateAsync: createPlacement,
        isPending: isCreatingPlacement,
        isSuccess: isCreatePlacementSuccess,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });

    const onDirtyChange = useCallback((key: string, isDirty: boolean) => {
        setDirtySections((prevState) => {
            if (prevState[key] === isDirty) {
                return prevState;
            }

            return {
                ...prevState,
                [key]: isDirty,
            };
        });
    }, []);

    const hasUnsavedChanges = useMemo(
        () => Object.values(dirtySections).some(Boolean),
        [dirtySections]
    );

    const handleTabChange = useCallback(
        (nextTab: "default" | string) => {
            if (nextTab === activeTab) return;

            if (
                hasUnsavedChanges &&
                !window.confirm(
                    "You have unsaved changes. Switch tab and discard local edits?"
                )
            ) {
                return;
            }

            setDirtySections({});
            setActiveTab(nextTab);
        },
        [activeTab, hasUnsavedChanges]
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
            setDirtySections({});
            setActiveTab(placementId);
        },
        [createPlacement, sdkConfig.placements]
    );

    if (!sdkConfigData) return null;

    return (
        <FormLayout>
            <MerchantHead merchantId={merchantId} />

            <SdkIdentityPanel
                merchantId={merchantId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />

            <CustomizationTabs
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
                    onDirtyChange={onDirtyChange}
                />
            ) : (
                <PlacementCustomization
                    merchantId={merchantId}
                    placementId={activeTab}
                    sdkConfig={sdkConfig}
                    onDirtyChange={onDirtyChange}
                    onSelectDefaultTab={() => handleTabChange("default")}
                />
            )}
        </FormLayout>
    );
}
