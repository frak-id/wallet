import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RefreshDatesFlow } from "@/module/recovery-setup/component/RefreshDatesFlow";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/recovery/dates"
)({
    component: RecoveryDates,
});

function RecoveryDates() {
    const navigate = useNavigate();
    return (
        <RefreshDatesFlow
            onAbort={() => navigate({ to: "/profile/recovery", replace: true })}
            onCompleted={() => navigate({ to: "/profile", replace: true })}
            onReplaceKey={() =>
                navigate({ to: "/profile/recovery/replace", replace: true })
            }
        />
    );
}
