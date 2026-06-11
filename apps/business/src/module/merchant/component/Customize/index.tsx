import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { pageBottomSpacer } from "@/module/common/component/FloatingFooter/floating-footer.css";
import { EditPageLayout } from "@/module/merchant/component/EditPageLayout";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { useSdkConfig } from "@/module/merchant/hook/useSdkConfig";
import { DefaultCustomization } from "./DefaultCustomization";
import { PlacementCustomization } from "./PlacementCustomization";
import { PlacementSelector } from "./PlacementSelector";
import { SaveFooter } from "./SaveFooter";
import { SdkIdentityPanel } from "./SdkIdentityPanel";
import { CustomizeSaveProvider } from "./saveRegistry";
import { getSdkConfig } from "./utils";

export function CustomizePage({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
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
    const [isSaving, setIsSaving] = useState(false);
    const submitHandlers = useRef(new Map<string, () => Promise<void>>());

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

    const registerSection = useCallback(
        (key: string, submit: () => Promise<void>) => {
            submitHandlers.current.set(key, submit);
            return () => {
                if (submitHandlers.current.get(key) === submit) {
                    submitHandlers.current.delete(key);
                }
            };
        },
        []
    );

    const saveContext = useMemo(
        () => ({ registerSection, onDirtyChange }),
        [registerSection, onDirtyChange]
    );

    const hasUnsavedChanges = useMemo(
        () => Object.values(dirtySections).some(Boolean),
        [dirtySections]
    );

    // Identity stays mounted across selector changes; only the customization
    // sections below the selector unmount (and lose their edits).
    const hasUnsavedSectionChanges = useMemo(
        () =>
            Object.entries(dirtySections).some(
                ([key, isDirty]) => isDirty && key !== "identity"
            ),
        [dirtySections]
    );

    // The backend merges each update over a fresh read of the stored config,
    // so concurrent saves would drop fields — submit sections one by one.
    const saveAll = useCallback(async () => {
        const dirtyKeys = Object.entries(dirtySections)
            .filter(([, isDirty]) => isDirty)
            .map(([key]) => key);

        setIsSaving(true);
        try {
            for (const key of dirtyKeys) {
                await submitHandlers.current.get(key)?.();
            }
        } finally {
            setIsSaving(false);
        }
    }, [dirtySections]);

    const confirmDiscard = useCallback(
        () =>
            !hasUnsavedChanges || window.confirm(t("customize.unsavedChanges")),
        [hasUnsavedChanges, t]
    );

    const handleTabChange = useCallback(
        (nextTab: "default" | string) => {
            if (nextTab === activeTab) return;
            if (
                hasUnsavedSectionChanges &&
                !window.confirm(t("customize.unsavedChanges"))
            ) {
                return;
            }

            setActiveTab(nextTab);
        },
        [activeTab, hasUnsavedSectionChanges, t]
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
                    onBeforeNavigate={confirmDiscard}
                >
                    <SdkIdentityPanel
                        merchantId={merchantId}
                        sdkConfig={sdkConfig}
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
                </EditPageLayout>
            </div>
            <SaveFooter
                disabled={!hasUnsavedChanges}
                isSaving={isSaving}
                onSave={saveAll}
            />
        </CustomizeSaveProvider>
    );
}
