import { Grid } from "@/module/common/component/Grid";
import { EnableNotification } from "@/module/notification/component/EnableNotification";
import { Balance } from "@/module/tokens/component/Balance";
import { HomeNavigation } from "@/module/wallet/component/HomeNavigation";
import { InstallApp } from "@/module/wallet/component/InstallApp";
import { OpenSession } from "@/module/wallet/component/OpenSession";
import { PendingReferral } from "@/module/wallet/component/PendingReferral";
import { Welcome } from "@/module/wallet/component/Welcome";
import { useHydrated } from "remix-utils/use-hydrated";

export default function Wallet() {
    const isHydrated = useHydrated();
    return (
        <Grid>
            <OpenSession />
            <Balance />
            <HomeNavigation />
            <Welcome />
            {/*<Invite />*/}
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
