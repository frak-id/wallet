import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { LogoFrak } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import * as styles from "./SsoHeader.css";

export function SsoHeader() {
    const { t } = useTranslation();
    return (
        <Box as="header" className={styles.ssoHeader}>
            <LogoFrak width={16} height={16} />
            <Text
                as="p"
                variant="bodySmall"
                className={styles.ssoHeader__title}
            >
                {t("authent.sso.header.title")}
            </Text>
        </Box>
    );
}
