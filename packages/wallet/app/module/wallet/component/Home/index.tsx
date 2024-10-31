import { Grid } from "@/module/common/component/Grid";
import { EnableNotification } from "@/module/notification/component/EnableNotification";
import { Tokens } from "@/module/tokens/component/Tokens";
import { ToggleSession } from "@/module/wallet/component/ToggleSession";
import { useHydrated } from "remix-utils/use-hydrated";
import { InstallApp } from "../InstallApp";
import { PendingReferral } from "../PendingReferral";

export function Wallet() {
    const isHydrated = useHydrated();
    return (
        <Grid>
            <ToggleSession />
            <Tokens />
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
