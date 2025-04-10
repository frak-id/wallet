import { Title } from "@/module/common/component/Title";
import { PairingDevices } from "@/module/pairing/component/PairingDevices";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

export function PairingHeader() {
    const { t } = useTranslation();

    return (
        <div className={styles.pairingHeader}>
            <Title size="big" align="center">
                {t("wallet.pairing.title")}
            </Title>
            <p className={styles.pairingHeader__text}>
                {t("wallet.pairing.text")}
            </p>
            <PairingDevices />
        </div>
    );
}
