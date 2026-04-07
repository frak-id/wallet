import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { RewardHistoryList } from "@/module/history/component/RewardHistory";

export function EarningsSection() {
    const { t } = useTranslation();

    return (
        <Box display="flex" flexDirection="column" gap="xs">
            <Text variant="bodySmall" weight="medium" color="secondary" as="h2">
                {t("reward.history.title")}
            </Text>
            <RewardHistoryList />
        </Box>
    );
}
