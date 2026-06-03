import { Button } from "@frak-labs/design-system/components/Button";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";

type SuccessStepProps = {
    onDone: () => void;
};

export function SuccessStep({ onDone }: SuccessStepProps) {
    const { t } = useTranslation();
    return (
        <EmailFlowResultScreen
            title={t("wallet.recoverySetup.success.title")}
            description={t("wallet.recoverySetup.success.description")}
        >
            <Button
                type="button"
                variant="primary"
                size="large"
                width="full"
                onClick={onDone}
            >
                {t("wallet.recoverySetup.success.done")}
            </Button>
        </EmailFlowResultScreen>
    );
}
