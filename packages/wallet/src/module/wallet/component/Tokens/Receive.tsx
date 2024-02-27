"use client";

import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { QRCodeWallet } from "@/module/wallet/component/QRCodeWallet";

export function TokensReceive() {
    return (
        <>
            <Back href={"/wallet"}>Back to wallet page</Back>
            <Grid>
                <QRCodeWallet />
            </Grid>
        </>
    );
}
