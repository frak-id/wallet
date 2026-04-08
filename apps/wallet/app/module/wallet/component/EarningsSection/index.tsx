import { Box } from "@frak-labs/design-system/components/Box";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Text } from "@frak-labs/design-system/components/Text";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { RewardHistoryList } from "@/module/history/component/RewardHistory";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";

export function EarningsSection() {
    const { t } = useTranslation();
    const { totalCount } = useGetRewardHistory();

    return (
        <Box display="flex" flexDirection="column" gap="xs">
            <Inline align="space-between" alignY="center">
                <Text
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                    as="h2"
                >
                    {t("reward.history.title")}
                </Text>
                {totalCount >= 5 && (
                    <Link to="/history">
                        <Text
                            variant="bodySmall"
                            weight="semiBold"
                            color="action"
                        >
                            {t("reward.history.viewAll")}
                        </Text>
                    </Link>
                )}
            </Inline>
            <RewardHistoryList />
        </Box>
    );
}
