import { Button } from "@frak-labs/design-system/components/Button";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";

type SuccessStepProps = {
    email: string;
    onBack: () => void;
    onVerifyEmail: () => void;
};

export function SuccessStep({
    email,
    onBack,
    onVerifyEmail,
}: SuccessStepProps) {
    const { t } = useTranslation();
    return (
        <EmailFlowResultScreen
            title={t("wallet.addEmail.success.title")}
            description={t("wallet.addEmail.success.description", { email })}
            onBack={onBack}
        >
            <Button
                type="button"
                variant="primary"
                size="large"
                width="full"
                onClick={onVerifyEmail}
            >
                {t("wallet.addEmail.success.verifyEmail")}
            </Button>
            <Button
                type="button"
                variant="secondary"
                size="large"
                width="full"
                onClick={onBack}
            >
                {t("wallet.addEmail.success.back")}
            </Button>
        </EmailFlowResultScreen>
    );
}
