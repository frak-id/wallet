import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { isCryptoMode } from "@/module/common/utils/walletMode";
import { QRCodeWallet } from "@/module/wallet/component/QRCodeWallet";

export const Route = createFileRoute("/_wallet/_protected/tokens/receive")({
    beforeLoad: () => {
        if (!isCryptoMode) {
            throw redirect({ to: "/wallet" });
        }
    },
    component: TokensReceivePage,
});

function TokensReceivePage() {
    const { t } = useTranslation();
    return (
        <>
            <Back href={"/wallet"}>{t("wallet.tokens.backToWallet")}</Back>
            <div>
                <QRCodeWallet />
            </div>
        </>
    );
}
