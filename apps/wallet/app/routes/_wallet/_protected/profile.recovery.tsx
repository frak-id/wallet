import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RecoveryConfiguration } from "@/module/recovery-setup/component/Configuration";
import { RecoverySetupFlow } from "@/module/recovery-setup/component/SetupFlow";
import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";
import { useRecoveryStatus } from "@/module/recovery-setup/hook/useRecoveryStatus";

export const Route = createFileRoute("/_wallet/_protected/profile/recovery")({
    component: ProfileRecovery,
});

function ProfileRecovery() {
    const navigate = useNavigate();
    const { recoverySetupStatus, isLoading: isChainLoading } =
        useRecoverySetupStatus();
    const { data: backendStatus, isLoading: isBackendLoading } =
        useRecoveryStatus();

    const goToProfile = () => navigate({ to: "/profile" });

    if (isChainLoading || isBackendLoading) {
        return null;
    }

    // "Configured" means recovery is enabled on-chain AND the encrypted blob is
    // synced on the backend. If it's only on-chain (blob never stored / save
    // failed), fall through to the setup flow so the user can store it — the
    // backend is insert-only, so a fresh save can't clobber an existing blob.
    const isConfigured = !!recoverySetupStatus && !!backendStatus?.configured;

    if (isConfigured) {
        return <RecoveryConfiguration onBack={goToProfile} />;
    }

    return (
        <RecoverySetupFlow onAbort={goToProfile} onCompleted={goToProfile} />
    );
}
