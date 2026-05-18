import { useWalletStatus } from "@frak-labs/react-sdk";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useDemoMode } from "@/module/common/atoms/demoMode";
import { Button } from "@/module/common/component/Button";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { DemoModeSwitch } from "@/module/settings/DemoModeSwitch";
import { SelectCurrency } from "@/module/settings/SelectCurrency";
import { useAuthStore } from "@/stores/authStore";
import { logoutButton, walletAddress } from "./settings.css";

export const Route = createFileRoute("/_restricted/settings")({
    component: Settings,
});

function Settings() {
    const navigate = useNavigate();
    const { data: walletStatus } = useWalletStatus();
    const { isDemoMode, setDemoMode } = useDemoMode();
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    return (
        <>
            <Head title={{ content: "Settings" }} />

            <Panel title="Wallet">
                <p className={walletAddress}>
                    Your wallet address is {walletStatus?.wallet}
                </p>
            </Panel>

            <Panel title="Currency">
                <SelectCurrency />
            </Panel>

            {isHydrated && !isDemoMode && (
                <Panel title="Demo Mode">
                    <DemoModeSwitch />
                </Panel>
            )}

            <Panel title="Logout">
                <p>
                    {isHydrated && isDemoMode
                        ? "Exit demo mode and return to the login page."
                        : "You will be logged out of your account."}
                </p>
                <Button
                    variant={"submit"}
                    className={logoutButton}
                    onClick={() => {
                        if (isDemoMode) {
                            setDemoMode(false);
                        }
                        useAuthStore.getState().clearAuth();
                        navigate({ to: "/login" });
                    }}
                >
                    {isHydrated && isDemoMode ? "Exit Demo Mode" : "Logout"}
                </Button>
            </Panel>
        </>
    );
}
