import { useCurrentEmail } from "@/module/authentication/hook/useCurrentEmail";
import { useBackendRecoveryStatus } from "@/module/recovery-setup/hook/useBackendRecoveryStatus";
import { useConnectedWalletRecovery } from "@/module/recovery-setup/hook/useConnectedWalletRecovery";
import { isExpiringSoon } from "@/module/recovery-setup/utils/recoveryDates";
import {
    resolveSecurityStep,
    type SecurityStep,
} from "@/module/settings/utils/securityStep";

export type WalletSecurityStatus = {
    /** The email attached to the wallet, when one exists. */
    email: string | null;
    hasEmail: boolean;
    isEmailVerified: boolean;
    hasRecovery: boolean;
    recoveryExpiringSoon: boolean;
    /** The single next step the user should take (or "secured"). */
    step: SecurityStep;
};

/**
 * Single source of truth for the wallet's protection state. Reads the email +
 * on-chain + backend recovery signals and resolves them into one funnel step.
 * Shared by the profile security card and the persistent recovery row so both
 * stay in sync without duplicating the "is recovery configured" logic.
 */
export function useWalletSecurityStatus(): WalletSecurityStatus {
    const { data: emailStatus } = useCurrentEmail();
    const { onChainRecovery } = useConnectedWalletRecovery();
    const { data: backendRecoveryStatus } = useBackendRecoveryStatus();

    const email = emailStatus?.email ?? null;
    const hasEmail = email != null;
    const isEmailVerified = emailStatus?.verified === true;
    // Configured = enabled on-chain AND blob synced on the backend; on-chain
    // only falls back to setup so the user can finish storing the blob.
    const hasRecovery =
        !!onChainRecovery && !!backendRecoveryStatus?.configured;
    const recoveryExpiringSoon = onChainRecovery
        ? isExpiringSoon(onChainRecovery.validUntil)
        : false;

    const step = resolveSecurityStep({
        hasEmail,
        isEmailVerified,
        hasRecovery,
        recoveryExpiringSoon,
    });

    return {
        email,
        hasEmail,
        isEmailVerified,
        hasRecovery,
        recoveryExpiringSoon,
        step,
    };
}
