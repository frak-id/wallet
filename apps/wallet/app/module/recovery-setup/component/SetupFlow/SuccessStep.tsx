import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { ShieldIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";
import type { RecoveryFlowMode } from "./index";

type SuccessStepProps = {
    mode: RecoveryFlowMode;
    onDone: () => void;
};

export function SuccessStep({ mode, onDone }: SuccessStepProps) {
    const { t } = useTranslation();
    return (
        <EmailFlowResultScreen
            icon={
                <IconCircle size="lg" tone="action">
                    <ShieldIcon width={28} height={28} />
                </IconCircle>
            }
            title={t(
                mode === "refresh"
                    ? "wallet.recoverySetup.refresh.successTitle"
                    : "wallet.recoverySetup.success.title"
            )}
            description={t(
                mode === "refresh"
                    ? "wallet.recoverySetup.refresh.successDescription"
                    : "wallet.recoverySetup.success.description"
            )}
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
