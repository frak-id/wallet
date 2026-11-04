import { motion } from "motion/react";
import { MaisonLuneLogo } from "@/art";
import { merchant } from "@/data/merchant";
import { useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import { bankMessages } from "../messages";
import { helia } from "../palette";
import * as styles from "./bankApp.css";
import { glyphs } from "./glyphs";

export type Transaction = {
    label: string;
    detail: "card" | "transfer";
    amount: number;
    daysAgo: number;
};

function RowIcon({ row }: { row: Transaction }) {
    if (row.label === merchant.name) {
        return (
            <span className={styles.rowIcon({ tone: "logo" })}>
                <MaisonLuneLogo variant="monogram" />
            </span>
        );
    }
    if (row.detail === "transfer") {
        return (
            <span className={styles.rowIcon({ tone: "credit" })}>
                {glyphs.incoming}
            </span>
        );
    }
    return (
        <span className={styles.rowIcon({ tone: "neutral" })}>
            {row.label.slice(0, 1)}
        </span>
    );
}

function RowContent({ row }: { row: Transaction }) {
    const t = useT(bankMessages);
    const money = useFormatMoney();
    const credit = row.amount > 0;
    return (
        <span className={styles.row}>
            <RowIcon row={row} />
            <span className={styles.rowText}>
                <span className={styles.rowLabel}>{row.label}</span>
                <span className={styles.rowDetail}>
                    {t(`detail.${row.detail}`)}
                </span>
            </span>
            <span className={styles.rowAmount({ credit })}>
                {credit ? `+${money(row.amount)}` : money(row.amount)}
            </span>
        </span>
    );
}

export function TransactionRow({ row }: { row: Transaction }) {
    return (
        <div className={styles.rowSlot}>
            <RowContent row={row} />
        </div>
    );
}

/** The statement line that arrives while the screen is up: slides in on `landed`, glowing. */
export function FreshTransactionRow({
    row,
    landed,
}: {
    row: Transaction;
    landed: boolean;
}) {
    return (
        <motion.div
            className={styles.rowSlot}
            aria-hidden={!landed}
            initial={false}
            animate={
                landed
                    ? {
                          height: "auto",
                          opacity: 1,
                          backgroundColor: helia.glow,
                      }
                    : {
                          height: 0,
                          opacity: 0,
                          backgroundColor: helia.glowStrong,
                      }
            }
            transition={{
                height: { duration: 0.45, ease: [0.32, 0.72, 0, 1] },
                opacity: { duration: 0.3, delay: 0.15 },
                backgroundColor: { duration: 1.6, delay: 0.5 },
            }}
        >
            <RowContent row={row} />
        </motion.div>
    );
}
