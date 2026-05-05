import { Box } from "@frak-labs/design-system/components/Box";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

export function OrDivider() {
    const { t } = useTranslation();
    return (
        <Inline space="s" alignY="center" align="center">
            <Box className={styles.line} />
            <Text variant="caption" color="tertiary">
                {t("common.or")}
            </Text>
            <Box className={styles.line} />
        </Inline>
    );
}
