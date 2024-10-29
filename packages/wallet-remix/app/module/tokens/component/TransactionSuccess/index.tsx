import { ExplorerTxLink } from "@/module/wallet/component/ExplorerLink";
import { TransactionHash } from "@module/component/HashDisplay";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import styles from "./index.module.css";

export function TransactionSuccess({ hash }: { hash: Hex }) {
    const { t } = useTranslation();
    return (
        <span className={styles.transactionSuccess}>
            {t("common.transactionSuccess")}
            <br />
            <br />
            {t("common.transactionHash")}{" "}
            <TransactionHash hash={hash} copiedText={t("common.copied")} />
            <br />
            <br />
            <ExplorerTxLink
                hash={hash}
                icon={false}
                className={styles.transactionSuccess__polygonLink}
                text={t("common.transactionLink")}
            />
        </span>
    );
}
