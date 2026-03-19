import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { isCryptoMode } from "@/module/common/utils/walletMode";
import * as styles from "./index.css";

export function Balance() {
    const { t } = useTranslation();
    const { userBalance } = useGetUserBalance();

    return (
        <Box
            className={styles.balance}
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap="m"
        >
            <Text variant="heading3" align="center">
                {isCryptoMode ? t("common.balance") : t("common.rewards")}
            </Text>
            <Text variant="heading1" align="center" className={styles.amount}>
                {userBalance?.total?.eurAmount?.toFixed(2) ?? 0}€
            </Text>
        </Box>
    );
}
