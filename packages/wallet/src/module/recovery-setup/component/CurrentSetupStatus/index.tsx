import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";
import { WalletAddress } from "@module/component/HashDisplay";
import { useTranslation } from "react-i18next";

/**
 * Component for the settings with the recovery options
 * @constructor
 */
export function CurrentRecoverySetupStatus() {
    const { t } = useTranslation();
    const { recoverySetupStatus } = useRecoverySetupStatus();

    if (!recoverySetupStatus) {
        return null;
    }

    return (
        <p>
            {t("wallet.recoverySetup.currentGuardian")}{" "}
            <WalletAddress wallet={recoverySetupStatus.guardianAddress} />
        </p>
    );
}
