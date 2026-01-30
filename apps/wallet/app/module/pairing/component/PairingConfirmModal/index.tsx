import { Button } from "@frak-labs/ui/component/Button";
import { getTargetPairingClient } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { PairingDropdown } from "@/module/pairing/component/PairingDropdown";
import { pendingPairingStore } from "@/module/pairing/stores/pendingPairingStore";
import styles from "./index.module.css";

export function PairingConfirmModal() {
    const { t } = useTranslation();
    const pendingPairing = pendingPairingStore((s) => s.pendingPairing);
    const { clearPendingPairing } = pendingPairingStore.getState();

    if (!pendingPairing) return null;

    const handleAccept = () => {
        const client = getTargetPairingClient();
        client.joinPairing(pendingPairing.id, pendingPairing.code);
        clearPendingPairing();
    };

    return (
        <PairingDropdown className={styles.pairingConfirmModal}>
            <div className={styles.pairingConfirmModal__card}>
                <h2 className={styles.pairingConfirmModal__title}>
                    {t("open-pair.confirm-title")}
                </h2>
                <p className={styles.pairingConfirmModal__description}>
                    {t("open-pair.confirm-description")}
                </p>
                <div className={styles.pairingConfirmModal__buttons}>
                    <Button
                        variant={"danger"}
                        size={"small"}
                        onClick={clearPendingPairing}
                        type={"button"}
                    >
                        {t("open-pair.reject")}
                    </Button>
                    <Button
                        variant={"primary"}
                        size={"small"}
                        onClick={handleAccept}
                        type={"button"}
                    >
                        {t("open-pair.accept")}
                    </Button>
                </div>
            </div>
        </PairingDropdown>
    );
}
