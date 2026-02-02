import { Button } from "@frak-labs/ui/component/Button";
import {
    getTargetPairingClient,
    useMountedTimeout,
    WalletModal,
} from "@frak-labs/wallet-shared";
import { Laptop, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { pendingPairingStore } from "@/module/pairing/stores/pendingPairingStore";
import styles from "./index.module.css";

const PAIRING_TTL_MS = 60_000;
const EXPIRED_DISPLAY_MS = 3_000;

export function PairingConfirmModal() {
    const { t } = useTranslation();
    const pendingPairing = pendingPairingStore((s) => s.pendingPairing);
    const clearPendingPairing = pendingPairingStore(
        (s) => s.clearPendingPairing
    );
    const [error, setError] = useState<string | null>(null);
    const [expired, setExpired] = useState(false);
    const { startTimeout: startTtlTimeout } = useMountedTimeout();
    const { startTimeout: startDisplayTimeout } = useMountedTimeout();

    useEffect(() => {
        if (!pendingPairing) return;
        setError(null);
        setExpired(false);
        startTtlTimeout(() => {
            setExpired(true);
            startDisplayTimeout(clearPendingPairing, EXPIRED_DISPLAY_MS);
        }, PAIRING_TTL_MS);
    }, [
        pendingPairing,
        clearPendingPairing,
        startTtlTimeout,
        startDisplayTimeout,
    ]);

    if (!pendingPairing) return null;

    const handleAccept = () => {
        try {
            const client = getTargetPairingClient();
            client.joinPairing(pendingPairing.id, pendingPairing.code);
            clearPendingPairing();
        } catch {
            setError(t("open-pair.error"));
        }
    };

    return (
        <WalletModal
            open={true}
            onOpenChange={(open) => {
                if (!open) clearPendingPairing();
            }}
            showCloseButton={false}
            classNameContent={styles.pairingModal}
            title={
                <span className={styles.pairingModal__titleRow}>
                    <ShieldCheck size={20} />
                    {t("open-pair.confirm-title")}
                </span>
            }
            text={
                <div className={styles.pairingModal__body}>
                    {expired ? (
                        <p className={styles.pairingModal__expired}>
                            {t("open-pair.expired")}
                        </p>
                    ) : (
                        <>
                            <div className={styles.pairingModal__device}>
                                <span
                                    className={styles.pairingModal__deviceIcon}
                                >
                                    <Laptop size={20} />
                                </span>
                                <p className={styles.pairingModal__description}>
                                    {t("open-pair.confirm-description")}
                                </p>
                            </div>
                            {error && (
                                <p className={styles.pairingModal__error}>
                                    {error}
                                </p>
                            )}
                        </>
                    )}
                </div>
            }
            cancel={
                expired ? undefined : (
                    <Button
                        variant={"ghost"}
                        size={"small"}
                        onClick={clearPendingPairing}
                        type={"button"}
                        className={styles.pairingModal__rejectBtn}
                    >
                        {t("open-pair.reject")}
                    </Button>
                )
            }
            action={
                expired ? undefined : (
                    <Button
                        variant={"secondary"}
                        size={"small"}
                        onClick={handleAccept}
                        type={"button"}
                    >
                        {t("open-pair.accept")}
                    </Button>
                )
            }
        />
    );
}
