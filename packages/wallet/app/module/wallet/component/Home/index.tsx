import { Grid } from "@/module/common/component/Grid";
import { EnableNotification } from "@/module/notification/component/EnableNotification";
import { Balance } from "@/module/tokens/component/Balance";
import { HomeNavigation } from "@/module/wallet/component/HomeNavigation";
import { ToggleSession } from "@/module/wallet/component/ToggleSession";
import { useHydrated } from "remix-utils/use-hydrated";
import { InstallApp } from "../InstallApp";
import { PendingReferral } from "../PendingReferral";

export function Wallet() {
    const isHydrated = useHydrated();
    return (
        <Grid>
            <ToggleSession />
            <Balance />
            <HomeNavigation />
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
