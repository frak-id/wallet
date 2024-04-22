import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";
import { WalletAddress } from "@/module/wallet/component/WalletAddress";
import { useChainId } from "wagmi";

/**
 * Component for the settings with the recovery options
 * @constructor
 */
export function CurrentRecoverySetupStatus() {
    const chainId = useChainId();

    const { recoverySetupStatus } = useRecoverySetupStatus({ chainId });

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
