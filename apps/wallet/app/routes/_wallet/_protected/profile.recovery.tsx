import { Box } from "@frak-labs/design-system/components/Box";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { RecoveryConfiguration } from "@/module/recovery-setup/component/Configuration";
import { RefreshDatesFlow } from "@/module/recovery-setup/component/RefreshDatesFlow";
import { RecoverySetupFlow } from "@/module/recovery-setup/component/SetupFlow";
import { useRecoverySetupStatus } from "@/module/recovery-setup/hook/useRecoverySetupStatus";
import { useRecoveryStatus } from "@/module/recovery-setup/hook/useRecoveryStatus";

export const Route = createFileRoute("/_wallet/_protected/profile/recovery")({
    component: ProfileRecovery,
});

type ConfiguredView = "config" | "dates" | "replace";

function ProfileRecovery() {
    const navigate = useNavigate();
    const { recoverySetupStatus, isLoading: isChainLoading } =
        useRecoverySetupStatus();
    const { data: backendStatus, isLoading: isBackendLoading } =
        useRecoveryStatus();
    const [view, setView] = useState<ConfiguredView>("config");

    const goToProfile = () => navigate({ to: "/profile" });
    const backToConfig = () => setView("config");

    if (isChainLoading || isBackendLoading) {
        return (
            <Box display="flex" justifyContent="center" padding="l">
                <Spinner />
            </Box>
        );
    }

    // "Configured" means recovery is enabled on-chain AND the encrypted blob is
    // synced on the backend. If it's only on-chain (blob never stored / save
    // failed), fall through to the setup flow so the user can store it.
    const isConfigured = !!recoverySetupStatus && !!backendStatus?.configured;

    if (!isConfigured) {
        return (
            <RecoverySetupFlow
                onAbort={goToProfile}
                onCompleted={goToProfile}
            />
        );
    }

    if (view === "dates") {
        return (
            <RefreshDatesFlow
                onAbort={backToConfig}
                onCompleted={goToProfile}
                onReplaceKey={() => setView("replace")}
            />
        );
    }

    if (view === "replace") {
        return (
            <RecoverySetupFlow
                mode="refresh"
                onAbort={backToConfig}
                onCompleted={goToProfile}
            />
        );
    }

    return (
        <RecoveryConfiguration
            onBack={goToProfile}
            onUpdateDates={() => setView("dates")}
            onReplaceKey={() => setView("replace")}
        />
    );
}
