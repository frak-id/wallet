import { formatHash } from "@frak-labs/ui/component/HashDisplay";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { useMoneriumIban } from "@/module/monerium/hooks/useMoneriumIban";
import styles from "./MoneriumIbanCard.module.css";

export function MoneriumIbanCard() {
    const { t } = useTranslation();
    const { iban, isLinkedToWallet, linkedAddress } = useMoneriumIban();
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!iban) return;
        await navigator.clipboard.writeText(iban);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (iban === null) {
        return (
            <div className={styles.moneriumIbanCard__noIban}>
                {t("monerium.iban.noIban")}
            </div>
        );
    }

    return (
        <div className={styles.moneriumIbanCard}>
            <p className={styles.moneriumIbanCard__iban}>{iban}</p>
            <button
                type="button"
                className={styles.moneriumIbanCard__copyButton}
                onClick={handleCopy}
            >
                {copied ? t("monerium.iban.copied") : t("monerium.iban.copy")}
            </button>

            {!isLinkedToWallet && linkedAddress && (
                <div className={styles.moneriumIbanCard__warning}>
                    {t("monerium.iban.warning", {
                        address: formatHash({ hash: linkedAddress as Hex }),
                    })}
                </div>
            )}
        </div>
    );
}
