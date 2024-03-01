"use client";

import { Grid } from "@/module/common/component/Grid";
import { InstallApp } from "@/module/wallet/component/InstallApp";
import { Tokens } from "@/module/wallet/component/Tokens";

/*
 * This lib can be nice to display a list of tokens on a wallet:
 *  - https://www.covalenthq.com/docs/unified-api/goldrush/kit/token-balances-list-view/
 */

export function WalletHomePage() {
    return (
        <Grid>
            <InstallApp />
            <Tokens />
        </Grid>
    );
}
