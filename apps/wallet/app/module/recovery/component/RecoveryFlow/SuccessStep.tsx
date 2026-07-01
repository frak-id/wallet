import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { ShieldIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";

type SuccessStepProps = {
    onDone: () => void;
};

export function SuccessStep({ onDone }: SuccessStepProps) {
    const { t } = useTranslation();
    return (
        <EmailFlowResultScreen
            icon={
                <IconCircle size="lg" tone="action">
                    <ShieldIcon width={28} height={28} />
                </IconCircle>
            }
            title={t("wallet.recoveryUsage.success.title")}
            description={t("wallet.recoveryUsage.success.description")}
        >
            <Button
                type="button"
                variant="primary"
                size="large"
                width="full"
                onClick={onDone}
            >
                {t("wallet.recoveryUsage.success.done")}
            </Button>
        </EmailFlowResultScreen>
    );
}
