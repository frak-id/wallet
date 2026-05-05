import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { LogoFrakWithName } from "@frak-labs/wallet-shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { openNativeStore } from "../../utils/nativeUpdater";
import * as styles from "./index.css";

type HardUpdateGateProps = {
    currentVersion: string;
    minVersion: string;
};

export function HardUpdateGate({
    currentVersion,
    minVersion,
}: HardUpdateGateProps) {
    const { t } = useTranslation();
    const [isOpening, setIsOpening] = useState(false);

    async function handleUpdate() {
        if (isOpening) return;
        setIsOpening(true);
        await openNativeStore();
        setIsOpening(false);
    }

    return (
        <Box
            padding="l"
            gap="xl"
            className={styles.gate}
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
        >
            <LogoFrakWithName className={styles.logo} />
            <Box flexDirection="column" alignItems="center" gap="m">
                <Text variant="heading1">{t("version.hardUpdate.title")}</Text>
                <Text variant="bodySmall">
                    {t("version.hardUpdate.description", {
                        currentVersion,
                        minVersion,
                    })}
                </Text>
            </Box>
            <Button onClick={handleUpdate} disabled={isOpening}>
                {t("version.hardUpdate.cta")}
            </Button>
        </Box>
    );
}
