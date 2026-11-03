import { BinIcon } from "@frak-labs/design-system/icons";
import type { DefaultTranslationKey } from "@frak-labs/wallet-shared/types";
import { useTranslation } from "react-i18next";
import { ReferralConfirmModal } from "../ReferralConfirmModal";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    isPending?: boolean;
    /** Resolved by the caller from the mutation error, so the modal stays presentational. */
    errorMessageKey?: DefaultTranslationKey | null;
};

/** Confirmation shown before unredeeming an active referral code. */
export function DeleteRedemptionConfirmModal({
    open,
    onOpenChange,
    onConfirm,
    isPending,
    errorMessageKey,
}: Props) {
    const { t } = useTranslation();
    return (
        <ReferralConfirmModal
            open={open}
            icon={BinIcon}
            title={t("wallet.referral.redeem.confirmDelete.title")}
            description={t("wallet.referral.redeem.confirmDelete.description")}
            confirmLabel={t("wallet.referral.redeem.confirmDelete.confirmCta")}
            cancelLabel={t("wallet.referral.redeem.confirmDelete.cancelCta")}
            confirmVariant="destructive"
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
            isPending={isPending}
            errorMessage={errorMessageKey ? t(errorMessageKey) : null}
        />
    );
}
