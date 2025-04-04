import { Warning } from "@/module/common/component/Warning";
import { useTranslation } from "react-i18next";
import { usePairingCode } from "../../hook/usePairingCode";

export function PairingInProgress() {
    const { t } = useTranslation();
    const { pairingCode } = usePairingCode();

    if (!pairingCode) return null;

    return <Warning text={t("wallet.pairing.pairingInProgress")} />;
}
