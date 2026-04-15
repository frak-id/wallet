import { useTranslation } from "react-i18next";
import { Warning } from "@/module/common/component/Warning";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";

export function PairingInProgress() {
    const { t } = useTranslation();
    const hasPendingPairing = pendingActionsStore((s) =>
        s.actions.some(
            (a) =>
                a.type === "navigation" &&
                a.to === "/pairing" &&
                !!a.search?.id &&
                a.expiresAt > Date.now()
        )
    );

    if (!hasPendingPairing) return null;

    return <Warning text={t("wallet.pairing.pairingInProgress")} />;
}
