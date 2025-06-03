import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

export function PairingCode({ code }: { code: string }) {
    const { t } = useTranslation();

    return (
        <div className={styles.pairingCode}>
            <p className={styles.pairingCode__title}>
                {t("wallet.pairing.code")}
            </p>
            <div className={styles.pairingCode__digits}>
                {code.split("").map((digit, index) => (
                    <div
                        key={`digit-${index}-${code.length}`}
                        className={styles.pairingCode__digit}
                    >
                        {digit}
                    </div>
                ))}
            </div>
        </div>
    );
}
