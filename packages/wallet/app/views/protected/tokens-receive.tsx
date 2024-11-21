import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { QRCodeWallet } from "@/module/wallet/component/QRCodeWallet";
import { useTranslation } from "react-i18next";

export default function TokensReceive() {
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
