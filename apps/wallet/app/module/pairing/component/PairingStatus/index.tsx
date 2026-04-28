import { Badge } from "@frak-labs/design-system/components/Badge";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, WarningCircleIcon } from "@frak-labs/design-system/icons";
import type { BasePairingState } from "@frak-labs/wallet-shared/pairing/types";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

export function PairingStatus({
    status,
}: {
    status: BasePairingState["status"];
}) {
    const { t } = useTranslation();

    switch (status) {
        case "idle":
            return (
                <Inline space="xxs" alignY="center">
                    <Text as="span" variant="bodySmall" color="warning">
                        {t("wallet.pairing.status.idle")}
                    </Text>
                    <span className={styles.iconWarning}>
                        <WarningCircleIcon width={16} height={16} />
                    </span>
                </Inline>
            );
        case "connecting":
            return (
                <Badge variant="warning">
                    <Inline space="xxs" alignY="center">
                        <Spinner size="s" />
                        {t("wallet.pairing.status.connecting")}
                    </Inline>
                </Badge>
            );
        case "paired":
            return (
                <Badge variant="success">
                    <Inline space="xxs" alignY="center">
                        <CheckIcon width={16} height={16} />
                        {t("wallet.pairing.status.paired")}
                    </Inline>
                </Badge>
            );
    }
}
