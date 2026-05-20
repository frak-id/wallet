import { Button } from "@frak-labs/design-system/components/Button";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";

type ConflictStepProps = {
    onUseDifferent: () => void;
    onBack: () => void;
};

/**
 * Phase 1 dead-end for the "email already attached to another wallet" branch.
 * Once wallet merge ships, the primary CTA flips to "Merge wallets" and this
 * screen becomes the merge confirm step.
 */
export function ConflictStep({ onUseDifferent, onBack }: ConflictStepProps) {
    const { t } = useTranslation();
    return (
        <EmailFlowResultScreen
            title={t("wallet.addEmail.conflict.title")}
            description={t("wallet.addEmail.conflict.description")}
            onBack={onBack}
        >
            <Button
                type="button"
                variant="primary"
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
