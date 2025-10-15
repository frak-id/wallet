import { useTranslation } from "react-i18next";
import { Warning } from "@/module/common/component/Warning";
import { usePendingPairingInfo } from "../../hook/usePendingPairingInfo";

export function PairingInProgress() {
    const { t } = useTranslation();
    const { pairingInfo } = usePendingPairingInfo();

    if (!pairingInfo) return null;

    return <Warning text={t("wallet.pairing.pairingInProgress")} />;
}
