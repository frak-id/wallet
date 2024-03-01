"use client";

import { Grid } from "@/module/common/component/Grid";
import { Tokens } from "@/module/tokens/component/Tokens";
import { InstallApp } from "@/module/wallet/component/InstallApp";
import {CreateWalletConnectConnection} from "@/module/wallet-connect/component/StartConnect";

export function WalletHomePage() {
    return (
        <Grid>
            <InstallApp />
            <Tokens />
            <CreateWalletConnectConnection />
        </Grid>
    );
}
