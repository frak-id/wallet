import { Grid } from "@/module/common/component/Grid";
import { EnableNotification } from "@/module/notification/component/EnableNotification";
import { Tokens } from "@/module/tokens/component/Tokens";
import { ToggleSession } from "@/module/wallet/component/ToggleSession";
import { InstallApp } from "../InstallApp";
import { PendingReferral } from "../PendingReferral";

export function Wallet() {
    return (
        <Grid>
            <ToggleSession />
            <Tokens />
            <InstallApp />
            <EnableNotification />
            <PendingReferral />
        </Grid>
    );
}
