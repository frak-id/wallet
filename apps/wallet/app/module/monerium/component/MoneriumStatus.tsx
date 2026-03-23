import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { useMoneriumIban } from "@/module/monerium/hooks/useMoneriumIban";
import { useMoneriumProfile } from "@/module/monerium/hooks/useMoneriumProfile";
import {
    isMoneriumConnected,
    moneriumStore,
} from "@/module/monerium/store/moneriumStore";
import styles from "./MoneriumStatus.module.css";

function shortenIban(iban: string): string {
    const ns = iban.replace(/\s/g, "");
    return ns.length > 11
        ? `${ns.substring(0, 4)}...${ns.substring(ns.length - 4)}`
        : iban;
}

export function MoneriumStatus() {
    const { t } = useTranslation();
    const isConnected = moneriumStore(isMoneriumConnected);
    const { profileState } = useMoneriumProfile();
    const { iban, isLinkedToWallet } = useMoneriumIban();

    if (!isConnected) {
        return null;
    }

    if (profileState === "pending") {
        return (
            <Panel variant={"invisible"} size={"none"}>
                <div
                    className={`${styles.moneriumStatus} ${styles["moneriumStatus--pending"]}`}
                >
                    <span className={styles.moneriumStatus__text}>
                        &#8987; {t("monerium.badge.pending")}
                    </span>
                </div>
            </Panel>
        );
    }

    if (profileState === "approved") {
        if (isLinkedToWallet && iban) {
            return (
                <Panel variant={"invisible"} size={"none"}>
                    <div
                        className={`${styles.moneriumStatus} ${styles["moneriumStatus--approved"]}`}
                    >
                        <span className={styles.moneriumStatus__text}>
                            &#10003; {t("monerium.badge.approved")}
                        </span>
                        <span className={styles.moneriumStatus__iban}>
                            {shortenIban(iban)}
                        </span>
                    </div>
                </Panel>
            );
        }

        if (!isLinkedToWallet) {
            return (
                <Panel variant={"invisible"} size={"none"}>
                    <div
                        className={`${styles.moneriumStatus} ${styles["moneriumStatus--warning"]}`}
                    >
                        <span className={styles.moneriumStatus__text}>
                            &#9888; {t("monerium.badge.notLinked")}
                        </span>
                    </div>
                </Panel>
            );
        }
    }

    if (profileState === "rejected" || profileState === "blocked") {
        return (
            <Panel variant={"invisible"} size={"none"}>
                <div
                    className={`${styles.moneriumStatus} ${styles["moneriumStatus--rejected"]}`}
                >
                    <span className={styles.moneriumStatus__text}>
                        &#10007; {t("monerium.badge.rejected")}
                    </span>
                </div>
            </Panel>
        );
    }

    return null;
}
