import { Spinner } from "@frak-labs/ui/component/Spinner";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BasePairingState } from "../../types";
import styles from "./index.module.css";

export function PairingStatus({
    status,
}: { status: BasePairingState["status"] }) {
    const statusDetails = getStatusDetails(status);

    return <span className={styles.pairingStatus}>{statusDetails}</span>;
}

function getStatusDetails(status: BasePairingState["status"]) {
    const { t } = useTranslation();

    switch (status) {
        case "idle":
            return t("wallet.pairing.status.idle");
        case "connecting":
            return (
                <span className={styles.pairingStatus__connecting}>
                    <Spinner />
                    {t("wallet.pairing.status.connecting")}
                </span>
            );
        case "paired":
            return (
                <span className={styles.pairingStatus__paired}>
                    <Check color="green" size={16} />
                    {t("wallet.pairing.status.paired")}
                </span>
            );
    }
}
