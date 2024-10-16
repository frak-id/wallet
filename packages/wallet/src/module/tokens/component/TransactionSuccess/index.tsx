import { ExplorerLink } from "@/module/wallet/component/PolygonLink";
import { WalletAddress } from "@module/component/HashDisplay";
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
            {t("common.transactionHash")} <WalletAddress wallet={hash} />
            <br />
            <br />
            <ExplorerLink
                hash={hash}
                icon={false}
                className={styles.transactionSuccess__polygonLink}
                text={t("common.transactionLink")}
            />
        </span>
    );
}
