import { formatDate } from "@/module/common/utils/formatDate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import styles from "./BudgetUsage.module.css";

export function BudgetUsage({ campaign }: { campaign: Campaign }) {
    const { budgetConfig, budgetUsed } = campaign;

    if (!budgetConfig || budgetConfig.length === 0) {
        return null;
    }

    return (
        <FormItem>
            <FormDescription label="Budget Usage" />
            <div className={styles.budgetUsage__list}>
                {budgetConfig.map((config) => {
                    const used = budgetUsed?.[config.label]?.used ?? 0;
                    const remaining = config.amount - used;
                    const resetAt = budgetUsed?.[config.label]?.resetAt;
                    const percentage =
                        config.amount > 0
                            ? Math.min((used / config.amount) * 100, 100)
                            : 0;

                    return (
                        <div
                            key={config.label}
                            className={styles.budgetUsage__item}
                        >
                            <div className={styles.budgetUsage__header}>
                                <span className={styles.budgetUsage__label}>
                                    {config.label}
                                </span>
                                <span className={styles.budgetUsage__amounts}>
                                    {formatPrice(remaining, undefined, "EUR")}{" "}
                                    remaining /{" "}
                                    {formatPrice(
                                        config.amount,
                                        undefined,
                                        "EUR"
                                    )}{" "}
                                    total
                                </span>
                            </div>
                            <div className={styles.budgetUsage__bar}>
                                <div
                                    className={styles.budgetUsage__barFill}
                                    style={{
                                        width: `${percentage}%`,
                                    }}
                                />
                            </div>
                            <div className={styles.budgetUsage__footer}>
                                <span className={styles.budgetUsage__spent}>
                                    {formatPrice(used, undefined, "EUR")} spent
                                </span>
                                {resetAt && (
                                    <span className={styles.budgetUsage__reset}>
                                        Resets: {formatDate(new Date(resetAt))}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </FormItem>
    );
}
