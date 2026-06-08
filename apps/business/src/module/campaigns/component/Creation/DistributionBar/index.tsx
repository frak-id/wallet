import { Text } from "@frak-labs/design-system/components/Text";
import * as styles from "./distribution.css";

type DistributionBarProps = {
    rewardsLabel: string;
    commissionLabel: string;
    /** The 80% (rewards) and 20% (Frak commission) amounts. */
    rewardsAmount: number;
    commissionAmount: number;
    /** Unit appended to each amount (€ for fixed, % for the percentage model). */
    suffix?: string;
};

/**
 * The 80/20 rewards-vs-commission proportion bar + legend, shared by the
 * Budget (step 4) and Reward (step 5) wizard steps. Frak always takes 20%.
 */
export function DistributionBar({
    rewardsLabel,
    commissionLabel,
    rewardsAmount,
    commissionAmount,
    suffix = "€",
}: DistributionBarProps) {
    const hasData = rewardsAmount + commissionAmount > 0;
    return (
        <div className={styles.distribution}>
            <div className={styles.bar}>
                {hasData ? (
                    <>
                        <div className={styles.barRewards} />
                        <div className={styles.barCommission} />
                    </>
                ) : null}
            </div>
            <div className={styles.legend}>
                <span className={styles.legendItem}>
                    <span
                        className={`${styles.square} ${hasData ? styles.squareRewards : styles.squareEmpty}`}
                    />
                    <Text variant="caption" color="primary">
                        {rewardsLabel} ({hasData ? 80 : 0}%) ·{" "}
                        <span className={styles.amountRewards}>
                            {rewardsAmount}
                            {suffix}
                        </span>
                    </Text>
                </span>
                <span className={styles.legendItem}>
                    <span
                        className={`${styles.square} ${hasData ? styles.squareCommission : styles.squareEmpty}`}
                    />
                    <Text variant="caption" color="primary">
                        {commissionLabel} ({hasData ? 20 : 0}%) ·{" "}
                        <span className={styles.amountCommission}>
                            {commissionAmount}
                            {suffix}
                        </span>
                    </Text>
                </span>
            </div>
        </div>
    );
}
