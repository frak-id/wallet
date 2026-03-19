import { isRunningInProd } from "@frak-labs/app-essentials";
import { SectionHeader } from "@frak-labs/design-system/components/SectionHeader";
import { createFileRoute } from "@tanstack/react-router";
import { memo } from "react";
import { useHydrated } from "remix-utils/use-hydrated";
import { MoneriumStatus } from "@/module/monerium/component/MoneriumStatus";
import { EnableNotification } from "@/module/notification/component/EnableNotification";
import { Balance } from "@/module/tokens/component/Balance";
import { DemoAccount } from "@/module/wallet/component/DemoAccount";
import { HomeNavigation } from "@/module/wallet/component/HomeNavigation";
import { InstallApp } from "@/module/wallet/component/InstallApp";
import { PendingReferral } from "@/module/wallet/component/PendingReferral";

export const Route = createFileRoute("/_wallet/_protected/wallet")({
    component: WalletPage,
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
            {!isRunningInProd && <MoneriumStatus />}
        </>
    );
});

/**
 * WalletPage
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
function WalletPage() {
    const isHydrated = useHydrated();

    return (
        <div>
            <SectionHeader title="Porte-monnaie" />
            <DemoAccount />
            <Balance />
            <HomeNavigation />
            {isHydrated && <HydratedComponents />}
        </div>
    );
}
