import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { EarningsIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import type { RewardHistoryItem as RewardHistoryItemType } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { Skeleton } from "@/module/common/component/Skeleton";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import * as styles from "./index.css";

export function RewardHistoryList() {
    const { items, isLoading } = useGetRewardHistory();

    if (isLoading) return <Skeleton count={3} height={110} />;

    if (!items || items.length === 0) {
        return <RewardHistoryEmpty />;
    }

    return (
        <Box>
            <Stack space="xs">
                {items.map((item, index) => (
                    <RewardHistoryItem
                        key={`${item.createdAt}-${index}`}
                        item={item}
                    />
                ))}
            </Stack>
        </Box>
    );
}

function RewardHistoryEmpty() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <Card className={styles.emptyLayout}>
            <IconCircle>
                <EarningsIcon color={vars.text.action} />
            </IconCircle>
            <Box display="flex" flexDirection="column" gap={"xxs"}>
                <Text variant="body" weight="semiBold" as="h3">
                    {t("reward.history.emptyTitle")}
                </Text>
                <Text variant="bodySmall" color="tertiary">
                    {t("reward.history.emptyDescription")}
                </Text>
            </Box>
            <Button
                variant="secondary"
                size="small"
                width="auto"
                onClick={() => navigate({ to: "/explorer" })}
            >
                {t("reward.history.discover")}
            </Button>
        </Card>
    );
}

function RewardHistoryItem({ item }: { item: RewardHistoryItemType }) {
    const { t } = useTranslation();

    const statusLabel = t(`reward.status.${item.status}`, item.status);

    const triggerLabel = t(`reward.trigger.${item.trigger}`, item.trigger);

    const roleLabel = t(`reward.role.${item.role}`, item.role);

    const displayAmount = `+${item.amount.amount.toFixed(2)} ${item.token.symbol}`;

    return (
        <Panel variant={"primary"} size={"small"}>
            <Stack space="xs">
                <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <Text variant="body" className={styles.itemMerchant}>
                        {item.merchant.name}
                    </Text>
                    <Text variant="body" className={styles.itemAmount}>
                        {displayAmount}
                    </Text>
                </Box>
                <Box
                    display="flex"
                    flexDirection="row"
                    gap="xs"
                    flexWrap="wrap"
                >
                    <Badge variant="neutral">{statusLabel}</Badge>
                    <Badge variant="neutral">{triggerLabel}</Badge>
                    <Badge variant="neutral">{roleLabel}</Badge>
                </Box>
                <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <Text variant="caption" className={styles.itemDate}>
                        {new Date(item.createdAt).toLocaleString()}
                    </Text>
                    {item.txHash && (
                        <Text variant="caption" className={styles.itemTxHash}>
                            {item.txHash.slice(0, 10)}...
                        </Text>
                    )}
                </Box>
            </Stack>
        </Panel>
    );
}
