import { Box } from "@frak-labs/design-system/components/Box";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { RecoveryConfiguration } from "@/module/recovery-setup/component/Configuration";
import { useBackendRecoveryStatus } from "@/module/recovery-setup/hook/useBackendRecoveryStatus";
import { useConnectedWalletRecovery } from "@/module/recovery-setup/hook/useConnectedWalletRecovery";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/recovery/"
)({
    component: ProfileRecovery,
});

function ProfileRecovery() {
    const navigate = useNavigate();
    const { onChainRecovery, isLoading: isChainLoading } =
        useConnectedWalletRecovery();
    const { data: backendStatus, isLoading: isBackendLoading } =
        useBackendRecoveryStatus();

    if (isChainLoading || isBackendLoading) {
        return (
            <Box display="flex" justifyContent="center" padding="l">
                <Spinner />
            </Box>
        );
    }

    // "Configured" means recovery is enabled on-chain AND the encrypted blob is
    // synced on the backend. When it isn't (blob never stored / save failed),
    // hand off to the setup route to store it. Each management sub-flow lives on
    // its own route so a flow that flips this status mid-run (e.g. delete) can't
    // bounce the user out before reaching its own success screen.
    const isConfigured = !!onChainRecovery && !!backendStatus?.configured;

    if (!isConfigured) {
        return <Navigate to="/profile/recovery/setup" replace />;
    }

    return (
        <RecoveryConfiguration
            onBack={() => navigate({ to: "/profile", replace: true })}
            onUpdateDates={() =>
                navigate({ to: "/profile/recovery/dates", replace: true })
            }
            onReplaceKey={() =>
                navigate({ to: "/profile/recovery/replace", replace: true })
            }
            onDelete={() =>
                navigate({ to: "/profile/recovery/delete", replace: true })
            }
        />
    );
}
