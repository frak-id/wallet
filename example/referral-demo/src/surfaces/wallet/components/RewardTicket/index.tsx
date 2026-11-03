import { Inline } from "@frak-labs/design-system/components/Inline";
import type { ReactNode } from "react";
import { MerchantLogo } from "../MerchantLogo";
import * as styles from "./rewardTicket.css";

/** The merchant reward drawn as a Frak-blue ticket: label, amount, then its status. */
export function RewardTicket({
    label,
    amount,
    chip,
    detail,
}: {
    label: string;
    amount: string;
    chip: { icon: ReactNode; label: string };
    detail: string;
}) {
    return (
        <div className={styles.ticket}>
            <span className={styles.glow} aria-hidden="true" />
            <Inline space="xs" alignY="center" wrap={false}>
                <MerchantLogo size="header" />
                <span className={styles.label}>{label}</span>
            </Inline>
            <span className={styles.amount}>{amount}</span>
            <div className={styles.footer}>
                <span className={styles.chip}>
                    {chip.icon}
                    {chip.label}
                </span>
                <span>{detail}</span>
            </div>
        </div>
    );
}
