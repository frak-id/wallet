import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { QRCodeWallet } from "@/module/wallet/component/QRCodeWallet";

/**
 * TokensReceivePage
 *
 * Page that displays a QR code for receiving tokens
 *
 * @returns {JSX.Element} The rendered tokens receive page
 */
export function TokensReceivePage() {
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
