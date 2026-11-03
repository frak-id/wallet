import { WarningIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { ReferralConfirmModal } from "../ReferralConfirmModal";

type Props = {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    isPending?: boolean;
};

/** Warns that a friend's code replacing Frak as referrer ends the exclusive cashback. */
export function ReplaceFrakReferrerModal({
    open,
    onConfirm,
    onCancel,
    isPending,
}: Props) {
    const { t } = useTranslation();
    return (
        <ReferralConfirmModal
            open={open}
            icon={WarningIcon}
            title={t("wallet.referral.redeem.replaceFrak.title")}
            description={t("wallet.referral.redeem.replaceFrak.description")}
            confirmLabel={t("wallet.referral.redeem.replaceFrak.confirmCta")}
            cancelLabel={t("wallet.referral.redeem.replaceFrak.cancelCta")}
            onConfirm={onConfirm}
            onCancel={onCancel}
            isPending={isPending}
        />
    );
}
