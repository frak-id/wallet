import { ExplorerLink } from "@/module/wallet/component/PolygonLink";
import { WalletAddress } from "@module/component/HashDisplay";
import type { Hex } from "viem";
import styles from "./index.module.css";

export function TransactionSuccess({ hash }: { hash: Hex }) {
    return (
        <span className={styles.transactionSuccess}>
            Transaction Success!
            <br />
            <br />
            Transaction Hash: <WalletAddress wallet={hash} />
            <br />
            <br />
            <ExplorerLink
                hash={hash}
                icon={false}
                className={styles.transactionSuccess__polygonLink}
                text={"Transaction Link (Polygonscan)"}
            />
        </span>
    );
}
