"use client";

import { Grid } from "@/module/common/component/Grid";
import { Tokens } from "@/module/tokens/component/Tokens";
import { PendingWalletConnectRequests } from "@/module/wallet-connect/component/PendingRequests";
import { CreateWalletConnectConnection } from "@/module/wallet-connect/component/StartConnect";
import { InstallApp } from "@/module/wallet/component/InstallApp";
import { PendingReferral } from "@/module/wallet/component/PendingReferral";
import { ToggleSession } from "@/module/wallet/component/ToggleSession";

export function WalletHomePage() {
    return (
        <Grid>
            <ToggleSession />
            <InstallApp />
            <PendingWalletConnectRequests />
            <Tokens />
            <CreateWalletConnectConnection />
            <PendingReferral />
        </Grid>
    );
}
