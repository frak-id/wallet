import { PencilIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { ReferralConfirmModal } from "../ReferralConfirmModal";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Confirm dismissal — caller should close the parent edit sheet. */
    onConfirm: () => void;
};

/** Asks before dismissing the edit sheet; sits on top of it, which stays mounted underneath. */
export function EditReferralCancelModal({
    open,
    onOpenChange,
    onConfirm,
}: Props) {
    const { t } = useTranslation();
    return (
        <ReferralConfirmModal
            open={open}
            icon={PencilIcon}
            title={t("wallet.referral.edit.cancelConfirm.title")}
            description={t("wallet.referral.edit.cancelConfirm.description")}
            confirmLabel={t("wallet.referral.edit.cancelConfirm.confirmCta")}
            cancelLabel={t("wallet.referral.edit.cancelConfirm.continueCta")}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
        />
    );
}
