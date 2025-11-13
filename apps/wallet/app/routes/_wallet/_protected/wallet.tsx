import { createFileRoute } from "@tanstack/react-router";
import { memo } from "react";
import { useHydrated } from "remix-utils/use-hydrated";
import { Grid } from "@/module/common/component/Grid";
import { EnableNotification } from "@/module/notification/component/EnableNotification";
import { Balance } from "@/module/tokens/component/Balance";
import { DemoAccount } from "@/module/wallet/component/DemoAccount";
import { HomeNavigation } from "@/module/wallet/component/HomeNavigation";
import { InstallApp } from "@/module/wallet/component/InstallApp";
import { OpenSession } from "@/module/wallet/component/OpenSession";
import { PendingReferral } from "@/module/wallet/component/PendingReferral";
import { Welcome } from "@/module/wallet/component/Welcome";

export const Route = createFileRoute("/_wallet/_protected/wallet")({
    component: Wallet,
});

/**
 * HydratedComponents
 *
 * A separate component for elements that should only render after hydration
 * This improves code organization and makes the hydration boundary clear
 */
const HydratedComponents = memo(function HydratedComponents() {
    return (
        <>
            <InstallApp />
            <EnableNotification />
            <PendingReferral />
        </>
    );
});

/**
 * Wallet
 *
 * The main wallet view component that displays:
 * - User's wallet session information
 * - Account balance
 * - Navigation options
 * - Welcome message
 * - Additional components after hydration (app installation, notifications, referrals)
 *
 * @returns {JSX.Element} The rendered wallet view
 */
function Wallet() {
    const isHydrated = useHydrated();

    return (
        <Grid>
            <DemoAccount />
            <OpenSession />
            <Balance />
            <HomeNavigation />
            <Welcome />
            {isHydrated && <HydratedComponents />}
        </Grid>
    );
}
