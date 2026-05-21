import type { MergeSettleResponse } from "@frak-labs/backend-elysia/api/schemas";
import { Button } from "@frak-labs/design-system/components/Button";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";

type SuccessStepProps = {
    /** Backend confirmation. Kept on the props so future copy can name the
     *  surviving wallet without re-deriving it on the client. */
    settle: MergeSettleResponse;
    /** Email the user had just typed when the conflict was raised. */
    email: string;
    onBack: () => void;
};

/**
 * Terminal success screen for a same-device wallet merge. Re-uses the
 * `EmailFlowResultScreen` scaffold so the visual is consistent with the
 * "email saved" screen the user would have landed on without the conflict.
 */
export function SuccessStep({ email, onBack }: SuccessStepProps) {
    const { t } = useTranslation();
    return (
        <EmailFlowResultScreen
            title={t("wallet.merge.success.title")}
            description={t("wallet.merge.success.description", { email })}
            onBack={onBack}
        >
            <Button
                type="button"
                variant="primary"
                size="large"
                width="full"
                onClick={onBack}
            >
                {t("wallet.merge.success.back")}
            </Button>
        </EmailFlowResultScreen>
    );
}
