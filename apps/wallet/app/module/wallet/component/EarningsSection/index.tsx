import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Text } from "@frak-labs/design-system/components/Text";
import { EarningsIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { useTranslation } from "react-i18next";
import { RewardHistoryList } from "@/module/history/component/RewardHistory";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import * as styles from "./index.css";

export function EarningsSection() {
    const { t } = useTranslation();
    const { items } = useGetRewardHistory();
    const hasHistory = items && items.length > 0;

    return (
        <Box display="flex" flexDirection="column" gap="xs">
            <Text variant="bodySmall" weight="medium" color="secondary" as="h2">
                {t("wallet.earnings.historyTitle")}
            </Text>
            {hasHistory ? <RewardHistoryList /> : <EarningsEmpty />}
        </Box>
    );
}

function EarningsEmpty() {
    const { t } = useTranslation();

    return (
        <Card className={styles.emptyLayout}>
            <IconCircle>
                <EarningsIcon color={vars.text.action} />
            </IconCircle>
            <Box display="flex" flexDirection="column" gap={"xxs"}>
                <Text variant="body" weight="semiBold" as="h3">
                    {t("wallet.earnings.emptyTitle")}
                </Text>
                <Text variant="bodySmall" color="tertiary">
                    {t("wallet.earnings.emptyDescription")}
                </Text>
            </Box>
            <Button variant="secondary" size="small" width="auto">
                {t("wallet.earnings.discover")}
            </Button>
        </Card>
    );
}
