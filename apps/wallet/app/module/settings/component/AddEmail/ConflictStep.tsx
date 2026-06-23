import { Button } from "@frak-labs/design-system/components/Button";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";

type ConflictStepProps = {
    /**
     * Whether the merge path is actually available. The parent computes it
     * from the conflicting wallet's credentials AND a live session, so the
     * "Combine accounts" CTA is hidden rather than rendered as a dead button
     * when the session isn't ready.
     */
    canMerge: boolean;
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
 *
 * Navigation: the top-left back arrow already routes to /profile, so we
 * deliberately do not duplicate it as a third bottom button. That keeps
 * the footer focused on the two real decisions (combine / use different).
 */
export function ConflictStep({
    canMerge,
    onMerge,
    onUseDifferent,
    onBack,
}: ConflictStepProps) {
    const { t } = useTranslation();
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
        </EmailFlowResultScreen>
    );
}
