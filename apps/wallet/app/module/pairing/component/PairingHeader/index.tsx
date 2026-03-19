import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { Title } from "@/module/common/component/Title";
import { PairingDevices } from "@/module/pairing/component/PairingDevices";
import * as styles from "./index.css";

export function PairingHeader() {
    const { t } = useTranslation();

    return (
        <Box className={styles.pairingHeader}>
            <Title size="big" align="center">
                {t("wallet.pairing.title")}
            </Title>
            <Text as="p" className={styles.pairingHeaderText}>
                {t("wallet.pairing.text")}
            </Text>
            <PairingDevices />
        </Box>
    );
}
