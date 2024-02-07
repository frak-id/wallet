"use client";

import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { PolygonLink } from "@/module/wallet/component/PolygonLink";
import type { FrkReceived as FrkReceivedType } from "@/types/HistoryItem";
import styles from "./index.module.css";

type ArticleUnlockProps = {
    frkReceived: FrkReceivedType;
};

export function FrkReceived({ frkReceived }: ArticleUnlockProps) {
    return (
        <div className={styles.frkReceived}>
            <h2 className={styles.frkReceived__title}>Fraks received</h2>
            <p>
                Transaction: <PolygonLink hash={frkReceived.txHash} />
            </p>
            <p>Frak amount: {formatFrk(Number(frkReceived.receivedAmount))}</p>
        </div>
    );
}
