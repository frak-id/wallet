import { Button } from "@frak-labs/design-system/components/Button";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";

type ConflictStepProps = {
    /**
     * Every credential currently bound to the conflicting wallet. When
     * non-empty we surface the single "Combine accounts" CTA; the merge
     * flow's discovery step then decides between same-device and
     * cross-device based on which path resolves first. Empty / undefined
     * means the backend resolved a wallet but no active binding on the
     * current chain — the user can only pick a different email.
     */
    targetAuthenticatorIds?: string[];
    /** Wallet bound to the conflicting credentials. */
    targetWallet?: Address;
    /** Launch the wallet-merge flow. Same CTA for same-device and
     *  cross-device — the discovery step inside MergeFlow auto-detects
     *  which path is available. */
    onMerge: () => void;
    onUseDifferent: () => void;
    onBack: () => void;
};

/**
 * Entry point for the "this email is on another wallet" branch. The
 * primary action launches the wallet-merge flow when the backend returned
 * the conflicting credential metadata; otherwise the user is steered back
 * to picking a different email.
 */
export function ConflictStep({
    targetAuthenticatorIds,
    targetWallet,
    onMerge,
    onUseDifferent,
    onBack,
}: ConflictStepProps) {
    const { t } = useTranslation();
    const canMerge = Boolean(targetAuthenticatorIds?.length && targetWallet);
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
