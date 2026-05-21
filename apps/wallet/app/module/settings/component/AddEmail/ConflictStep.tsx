import { Button } from "@frak-labs/design-system/components/Button";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";

type ConflictStepProps = {
    /**
     * Conflicting credential id returned by the AddEmail conflict branch.
     * When present we surface the "Combine accounts" CTA — without it the
     * same-device merge flow has nothing to point at, so the user can only
     * pick a different email.
     */
    targetAuthenticatorId?: string;
    /** Wallet bound to the conflicting credential. */
    targetWallet?: Address;
    onMerge: () => void;
    onUseDifferent: () => void;
    onBack: () => void;
};

/**
 * Entry point for the "this email is on another wallet" branch. The
 * primary action launches the same-device wallet-merge flow when the
 * backend returned the conflicting credential metadata; otherwise the user
 * is steered back to picking a different email.
 */
export function ConflictStep({
    targetAuthenticatorId,
    targetWallet,
    onMerge,
    onUseDifferent,
    onBack,
}: ConflictStepProps) {
    const { t } = useTranslation();
    const canMerge = Boolean(targetAuthenticatorId) && Boolean(targetWallet);
    return (
        <EmailFlowResultScreen
            title={t("wallet.addEmail.conflict.title")}
            description={
                canMerge
                    ? t("wallet.addEmail.conflict.descriptionMergeable")
                    : t("wallet.addEmail.conflict.description")
            }
            onBack={onBack}
        >
            {canMerge && (
                <Button
                    type="button"
                    variant="primary"
                    size="large"
                    width="full"
                    onClick={onMerge}
                >
                    {t("wallet.addEmail.conflict.combine")}
                </Button>
            )}
            <Button
                type="button"
                variant={canMerge ? "secondary" : "primary"}
                size="large"
                width="full"
                onClick={onUseDifferent}
            >
                {t("wallet.addEmail.conflict.useDifferent")}
            </Button>
            <Button
                type="button"
                variant="secondary"
                size="large"
                width="full"
                onClick={onBack}
            >
                {t("wallet.addEmail.conflict.back")}
            </Button>
        </EmailFlowResultScreen>
    );
}
