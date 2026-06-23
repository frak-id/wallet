import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RecoverySetupFlow } from "@/module/recovery-setup/component/SetupFlow";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/recovery/replace"
)({
    component: RecoveryReplace,
});

function RecoveryReplace() {
    const navigate = useNavigate();
    return (
        <RecoverySetupFlow
            mode="refresh"
            onAbort={() => navigate({ to: "/profile/recovery", replace: true })}
            onCompleted={() => navigate({ to: "/profile", replace: true })}
        />
    );
}
