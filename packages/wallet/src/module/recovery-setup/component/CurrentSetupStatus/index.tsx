import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";
import { WalletAddress } from "@module/component/HashDisplay";

/**
 * Component for the settings with the recovery options
 * @constructor
 */
export function CurrentRecoverySetupStatus() {
    const { recoverySetupStatus } = useRecoverySetupStatus();

    if (!recoverySetupStatus) {
        return null;
    }

    return (
        <p>
            Current guardian:{" "}
            <WalletAddress wallet={recoverySetupStatus.guardianAddress} />
        </p>
    );
}
