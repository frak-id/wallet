import { useWalletStatus } from "@frak-labs/react-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { deleteSession } from "@/context/auth/session";
import { useDemoMode } from "@/module/common/atoms/demoMode";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { DemoModeSwitch } from "@/module/settings/DemoModeSwitch";
import { SelectCurrency } from "@/module/settings/SelectCurrency";
import styles from "./settings.module.css";

export const Route = createFileRoute("/_restricted/settings")({
    component: Settings,
});

function Settings() {
    const navigate = useNavigate();
    const { data: walletStatus } = useWalletStatus();
    const { isDemoMode, setDemoMode } = useDemoMode();
    const [isHydrated, setIsHydrated] = useState(false);

    // Prevent hydration mismatch by waiting for client-side hydration
    useEffect(() => {
        setIsHydrated(true);
    }, []);

    return (
        <>
            <Head title={{ content: "Settings" }} />

            <Panel title="Wallet">
                <p className={styles.walletAddress}>
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
                    className={styles.logoutButton}
                    onClick={() => {
                        // If in demo mode, exit demo mode first
                        if (isDemoMode) {
                            setDemoMode(false);
                        }
                        // Delete session and redirect to login
                        deleteSession().then(() => {
                            navigate({ to: "/login" });
                        });
                    }}
                >
                    {isHydrated && isDemoMode ? "Exit Demo Mode" : "Logout"}
                </Button>
            </Panel>
        </>
    );
}
