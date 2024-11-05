import { Grid } from "@/module/common/component/Grid";
import { EnableNotification } from "@/module/notification/component/EnableNotification";
import { Balance } from "@/module/tokens/component/Balance";
import { HomeNavigation } from "@/module/wallet/component/HomeNavigation";
import { ToggleSession } from "@/module/wallet/component/ToggleSession";
import { useHydrated } from "remix-utils/use-hydrated";
import { InstallApp } from "../InstallApp";
import { Invite } from "../Invite";
import { PendingReferral } from "../PendingReferral";
import { Welcome } from "../Welcome";

export function Wallet() {
    const isHydrated = useHydrated();
    return (
        <Grid>
            <ToggleSession />
            <Balance />
            <HomeNavigation />
            <Welcome />
            <Invite />
            {isHydrated && (
                <>
                    <InstallApp />
                    <EnableNotification />
                    <PendingReferral />
                </>
            )}
        </Grid>
    );
}
