import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { RewardHistoryItem as RewardHistoryItemType } from "@frak-labs/wallet-shared";
import { Gift } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { Skeleton } from "@/module/common/component/Skeleton";
import { isCryptoMode } from "@/module/common/utils/walletMode";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import * as styles from "./index.css";

export function RewardHistoryList() {
    const { items, isLoading } = useGetRewardHistory();

    if (isLoading) return <Skeleton count={3} height={110} />;

    if (!items || items.length === 0) {
        return <RewardHistoryEmpty />;
    }

    return (
        <Box className={styles.list}>
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

    return (
        <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            padding="l"
            gap="m"
            className={styles.empty}
        >
            <Gift size={48} className={styles.emptyIcon} />
            <Text variant="heading4" className={styles.emptyTitle}>
                {t("reward.history.empty")}
            </Text>
            <Text variant="bodySmall" className={styles.emptyDescription}>
                {t(
                    "reward.history.emptyDescription",
                    "Your rewards will appear here once you start earning"
                )}
            </Text>
        </Box>
    );
}

function RewardHistoryItem({ item }: { item: RewardHistoryItemType }) {
    const { t } = useTranslation();

    const statusLabel = t(`reward.status.${item.status}`, item.status);

    const triggerLabel = t(`reward.trigger.${item.trigger}`, item.trigger);

    const roleLabel = t(`reward.role.${item.role}`, item.role);

    const displayAmount = isCryptoMode
        ? `+${item.amount.amount.toFixed(2)} ${item.token.symbol}`
        : `+${item.amount.eurAmount.toFixed(2)}€`;

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
                    {isCryptoMode && item.txHash && (
                        <Text variant="caption" className={styles.itemTxHash}>
                            {item.txHash.slice(0, 10)}...
                        </Text>
                    )}
                </Box>
            </Stack>
        </Panel>
    );
}
