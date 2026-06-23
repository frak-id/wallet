import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { pageBottomSpacer } from "@/module/common/component/FloatingFooter/floating-footer.css";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { EditPageLayout } from "@/module/merchant/component/EditPageLayout";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { useSdkConfig } from "@/module/merchant/hook/useSdkConfig";
import { CustomizeSaveProvider } from "../saveRegistry";
import { DefaultCustomization } from "./DefaultCustomization";
import { PlacementCustomization } from "./PlacementCustomization";
import { PlacementSelector } from "./PlacementSelector";
import { SaveFooter } from "./SaveFooter";
import { SdkIdentityPanel } from "./SdkIdentityPanel";
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
    const [saveError, setSaveError] = useState(false);
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
        setIsSaving(true);
        setSaveError(false);
        try {
            for (const [key, isDirty] of Object.entries(dirtySections)) {
                if (!isDirty) continue;
                try {
                    await submitHandlers.current.get(key)?.();
                } catch {
                    // Failed/invalid section stays dirty; keep saving the rest.
                    setSaveError(true);
                }
            }
        } finally {
            setIsSaving(false);
        }
    }, [dirtySections]);

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
