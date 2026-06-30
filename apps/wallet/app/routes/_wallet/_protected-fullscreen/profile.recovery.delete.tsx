import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DeleteRecoveryFlow } from "@/module/recovery-setup/component/DeleteRecoveryFlow";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/recovery/delete"
)({
    component: RecoveryDelete,
});

function RecoveryDelete() {
    const navigate = useNavigate();
    return (
        <DeleteRecoveryFlow
            onAbort={() => navigate({ to: "/profile/recovery", replace: true })}
            onCompleted={() => navigate({ to: "/profile", replace: true })}
        />
    );
}
