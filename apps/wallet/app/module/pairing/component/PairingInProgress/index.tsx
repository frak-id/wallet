import { useTranslation } from "react-i18next";
import { Warning } from "@/module/common/component/Warning";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import * as styles from "./index.css";

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

    return (
        <div className={styles.toast}>
            <Warning text={t("wallet.pairing.pairingInProgress")} />
        </div>
    );
}
