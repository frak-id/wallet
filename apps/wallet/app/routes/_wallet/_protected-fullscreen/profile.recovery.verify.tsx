import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { VerifyPasswordFlow } from "@/module/recovery-setup/component/VerifyPasswordFlow";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/recovery/verify"
)({
    component: RecoveryVerify,
});

function RecoveryVerify() {
    const navigate = useNavigate();
    return (
        <VerifyPasswordFlow
            onBack={() => navigate({ to: "/profile/recovery", replace: true })}
        />
    );
}
