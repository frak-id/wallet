import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { pageBottomSpacer } from "@/module/common/component/FloatingFooter/floating-footer.css";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { EditPageLayout } from "@/module/merchant/component/EditPageLayout";
import { useReadOnlyMerchant } from "@/module/merchant/hook/useReadOnlyMerchant";
import { useSectionedSave } from "@/module/merchant/hook/useSectionedSave";
import { SaveFooter } from "../Customize/SaveFooter";
import { CustomizeSaveProvider } from "../saveRegistry";
import { ExplorerSettings } from "./ExplorerSettings";
import { ExplorerSummary } from "./ExplorerSummary";

/**
 * "Explorer" tab: how the merchant is presented inside the Frak Explorer
 * app (listing toggle, hero imagery, logo, description).
 */
export function ExplorerPage({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const isReadOnly = useReadOnlyMerchant({ merchantId });
    const { saveContext, hasUnsavedChanges, isSaving, saveError, saveAll } =
        useSectionedSave();

    const { guard: guardNavigate, dialogProps: discardDialogProps } =
        useDiscardGuard({ isDirty: hasUnsavedChanges });

    return (
        <CustomizeSaveProvider value={saveContext}>
            <div className={pageBottomSpacer}>
                <EditPageLayout
                    merchantId={merchantId}
                    page="explorer"
                    guardNavigate={guardNavigate}
                >
                    {isReadOnly ? (
                        <ExplorerSummary merchantId={merchantId} />
                    ) : (
                        <ExplorerSettings merchantId={merchantId} />
                    )}
                    {saveError && (
                        <Text variant="caption" color="error">
                            {t("merchantEdit.saveError")}
                        </Text>
                    )}
                </EditPageLayout>
            </div>
            {!isReadOnly && (
                <SaveFooter
                    disabled={!hasUnsavedChanges}
                    isSaving={isSaving}
                    onSave={saveAll}
                    label={t("merchantEdit.saveAll")}
                />
            )}
            <DiscardChangesDialog {...discardDialogProps} />
        </CustomizeSaveProvider>
    );
}
