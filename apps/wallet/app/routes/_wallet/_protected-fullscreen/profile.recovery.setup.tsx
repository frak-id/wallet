import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RecoverySetupFlow } from "@/module/recovery-setup/component/SetupFlow";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/recovery/setup"
)({
    component: RecoverySetup,
});

function RecoverySetup() {
    const navigate = useNavigate();
    const goToProfile = () => navigate({ to: "/profile", replace: true });
    return (
        <RecoverySetupFlow onAbort={goToProfile} onCompleted={goToProfile} />
    );
}
