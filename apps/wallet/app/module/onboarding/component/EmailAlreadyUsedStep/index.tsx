import { Button } from "@frak-labs/design-system/components/Button";
import { useWebauthnErrorToast } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";

type EmailAlreadyUsedStepProps = {
    email: string;
    onLogin: () => void;
    onBack: () => void;
    isLoginLoading?: boolean;
    /** Error from the parent login mutation, surfaced as a top toast. */
    loginError?: Error | null;
};

export function EmailAlreadyUsedStep({
    email,
    onLogin,
    onBack,
    isLoginLoading = false,
    loginError,
}: EmailAlreadyUsedStepProps) {
    const { t } = useTranslation();

    useWebauthnErrorToast(loginError, {
        operation: "login",
        onRetry: onLogin,
    });
    return (
        <EmailFlowResultScreen
            title={t("onboarding.email.alreadyUsed.title")}
            description={t("onboarding.email.alreadyUsed.description", {
                email,
            })}
            onBack={onBack}
        >
            <Button
                type="button"
                variant="primary"
                size="large"
                width="full"
                onClick={onLogin}
                loading={isLoginLoading}
            >
                {t("onboarding.email.alreadyUsed.login")}
            </Button>
            <Button
                type="button"
                variant="secondary"
                size="large"
                width="full"
                onClick={onBack}
            >
                {t("onboarding.email.alreadyUsed.useDifferent")}
            </Button>
        </EmailFlowResultScreen>
    );
}
