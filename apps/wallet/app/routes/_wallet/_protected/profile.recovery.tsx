import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RecoveryConfiguration } from "@/module/recovery-setup/component/Configuration";
import { RecoverySetupFlow } from "@/module/recovery-setup/component/SetupFlow";
import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";

export const Route = createFileRoute("/_wallet/_protected/profile/recovery")({
    component: ProfileRecovery,
});

function ProfileRecovery() {
    const navigate = useNavigate();
    const { recoverySetupStatus, isLoading } = useRecoverySetupStatus();

    const goToProfile = () => navigate({ to: "/profile" });

    if (isLoading) {
        return null;
    }

    if (recoverySetupStatus) {
        return <RecoveryConfiguration onBack={goToProfile} />;
    }

    return (
        <RecoverySetupFlow onAbort={goToProfile} onCompleted={goToProfile} />
    );
}
