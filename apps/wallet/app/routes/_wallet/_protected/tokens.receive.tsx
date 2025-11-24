import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { QRCodeWallet } from "@/module/wallet/component/QRCodeWallet";

export const Route = createFileRoute("/_wallet/_protected/tokens/receive")({
    component: TokensReceivePage,
});

function TokensReceivePage() {
    const { t } = useTranslation();
    return (
        <>
            <Back href={"/wallet"}>{t("wallet.tokens.backToWallet")}</Back>
            <Grid>
                <QRCodeWallet />
            </Grid>
        </>
    );
}
