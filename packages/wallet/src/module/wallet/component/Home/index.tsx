"use client";

import { Grid } from "@/module/common/component/Grid";
import { EnableNotification } from "@/module/notification/component/EnableNotification";
import { Tokens } from "@/module/tokens/component/Tokens";
import { InstallApp } from "@/module/wallet/component/InstallApp";
import { PendingReferral } from "@/module/wallet/component/PendingReferral";
import { ToggleSession } from "@/module/wallet/component/ToggleSession";

export function WalletHomePage() {
    return (
        <Grid>
            <ToggleSession />
            <InstallApp />
            <EnableNotification />
            <Tokens />
            <PendingReferral />
        </Grid>
    );
}
