import { Button } from "@frak-labs/design-system/components/Button";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { pageBottomSpacer } from "@/module/common/component/FloatingFooter/floating-footer.css";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { useHasRoleOnMerchant } from "@/module/common/hook/useHasRoleOnMerchant";
import { ButtonAddTeam } from "@/module/merchant/component/ButtonAddTeam";
import { SaveFooter } from "@/module/merchant/component/Customize/SaveFooter";
import { EditPageLayout } from "@/module/merchant/component/EditPageLayout";
import { TableTeam } from "@/module/merchant/component/TableTeam";
import { useAdminMutation } from "@/module/merchant/hook/useAdminMutation";
import { useMerchant } from "@/module/merchant/hook/useMerchant";

export function MerchantTeam({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { data: merchant, isLoading } = useMerchant({ merchantId });
    const { hasAccess } = useHasRoleOnMerchant({ merchantId });

    const [staged, setStaged] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);

    const { mutateAsync: removeAdmin } = useAdminMutation({ action: "remove" });

    const onToggleRemoval = useCallback((adminId: string) => {
        setSaveError(false);
        setStaged((prev) =>
            prev.includes(adminId)
                ? prev.filter((id) => id !== adminId)
                : [...prev, adminId]
        );
    }, []);

    const saveAll = useCallback(async () => {
        setIsSaving(true);
        setSaveError(false);
        try {
            // Un-stage each admin as its removal lands, so a mid-loop failure
            // never leaves already-removed admins staged for a retry.
            for (const adminId of staged) {
                await removeAdmin({ merchantId, adminId });
                setStaged((prev) => prev.filter((id) => id !== adminId));
            }
        } catch {
            setSaveError(true);
        } finally {
            setIsSaving(false);
        }
    }, [staged, merchantId, removeAdmin]);

    const { guard: guardNavigate, dialogProps: discardDialogProps } =
        useDiscardGuard({
            isDirty: staged.length > 0,
            onDiscard: () => setStaged([]),
        });

    if (isLoading || !merchant) {
        return (
            <EditPageLayout merchantId={merchantId} page="team">
                <Spinner />
            </EditPageLayout>
        );
    }

    return (
        <>
            <div className={pageBottomSpacer}>
                <EditPageLayout
                    merchantId={merchantId}
                    page="team"
                    guardNavigate={guardNavigate}
                >
                    <TableTeam
                        merchantId={merchantId}
                        stagedRemovals={staged}
                        onToggleRemoval={onToggleRemoval}
                        disabled={isSaving}
                    />
                    {hasAccess && (
                        <ButtonAddTeam merchantId={merchantId}>
                            <Button variant="secondary">
                                {t("merchantEdit.team.addMember")}
                            </Button>
                        </ButtonAddTeam>
                    )}
                    {saveError && (
                        <Text variant="caption" color="error">
                            {t("merchantEdit.team.saveError")}
                        </Text>
                    )}
                </EditPageLayout>
            </div>
            <SaveFooter
                disabled={staged.length === 0}
                isSaving={isSaving}
                onSave={saveAll}
                label={t("merchantEdit.team.saveAll")}
            />
            <DiscardChangesDialog {...discardDialogProps} />
        </>
    );
}
