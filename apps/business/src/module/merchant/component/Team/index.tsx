import { Button } from "@frak-labs/design-system/components/Button";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { isAddressEqual } from "viem";
import { pageBottomSpacer } from "@/module/common/component/FloatingFooter/floating-footer.css";
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

    const [staged, setStaged] = useState<Address[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);

    const { mutateAsync: removeAdmin } = useAdminMutation({ action: "remove" });

    const onToggleRemoval = useCallback((wallet: Address) => {
        setSaveError(false);
        setStaged((prev) =>
            prev.some((a) => isAddressEqual(a, wallet))
                ? prev.filter((a) => !isAddressEqual(a, wallet))
                : [...prev, wallet]
        );
    }, []);

    const saveAll = useCallback(async () => {
        setIsSaving(true);
        setSaveError(false);
        try {
            // Un-stage each wallet as its removal lands, so a mid-loop failure
            // never leaves already-removed wallets staged for a retry.
            for (const wallet of staged) {
                await removeAdmin({ merchantId, wallet });
                setStaged((prev) =>
                    prev.filter((a) => !isAddressEqual(a, wallet))
                );
            }
        } catch {
            setSaveError(true);
        } finally {
            setIsSaving(false);
        }
    }, [staged, merchantId, removeAdmin]);

    const confirmDiscard = useCallback(
        () =>
            staged.length === 0 ||
            window.confirm(t("customize.unsavedChanges")),
        [staged, t]
    );

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
                    onBeforeNavigate={confirmDiscard}
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
        </>
    );
}
