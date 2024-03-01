import { PolygonLink } from "@/module/wallet/component/PolygonLink";
import styles from "./index.module.css";

export function TransactionSuccess({ hash }: { hash: string }) {
    return (
        <>
            Transaction Success!
            <br />
            <br />
            Transaction Hash:{" "}
            <PolygonLink
                hash={hash}
                icon={false}
                className={styles.transactionSuccess__polygonLink}
            />
        </>
    );
}
