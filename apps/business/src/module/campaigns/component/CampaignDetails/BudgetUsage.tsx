import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { formatDate } from "@/module/common/utils/formatDate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import * as styles from "./budget-usage.css";

export function BudgetUsage({ campaign }: { campaign: Campaign }) {
    const { budgetConfig, budgetUsed } = campaign;

    if (!budgetConfig || budgetConfig.length === 0) {
        return null;
    }

    return (
        <FormItem>
            <FormDescription label="Budget Usage" />
            <Stack space="s">
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
                            className={styles.budgetUsageItem}
                        >
                            <Box
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                marginBottom="xs"
                            >
                                <span className={styles.budgetUsageLabel}>
                                    {config.label}
                                </span>
                                <Text
                                    as="span"
                                    variant="bodySmall"
                                    color="secondary"
                                >
                                    {formatPrice(remaining, undefined, "EUR")}{" "}
                                    remaining /{" "}
                                    {formatPrice(
                                        config.amount,
                                        undefined,
                                        "EUR"
                                    )}{" "}
                                    total
                                </Text>
                            </Box>
                            <div className={styles.budgetUsageBar}>
                                <div
                                    className={styles.budgetUsageBarFill}
                                    style={{
                                        width: `${percentage}%`,
                                    }}
                                />
                            </div>
                            <div className={styles.budgetUsageFooter}>
                                <Text
                                    as="span"
                                    variant="caption"
                                    color="secondary"
                                >
                                    {formatPrice(used, undefined, "EUR")} spent
                                </Text>
                                {resetAt && (
                                    <span className={styles.budgetUsageReset}>
                                        Resets: {formatDate(new Date(resetAt))}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </Stack>
        </FormItem>
    );
}
