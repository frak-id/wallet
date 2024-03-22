"use client";

import { Grid } from "@/module/common/component/Grid";
import { Tokens } from "@/module/tokens/component/Tokens";
import { InstallApp } from "@/module/wallet/component/InstallApp";

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
