import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import type { BasePairingState } from "@frak-labs/wallet-shared/pairing/types";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

export function PairingStatus({
    status,
}: {
    status: BasePairingState["status"];
}) {
    const statusDetails = useStatusDetails(status);

    return (
        <Box as="span" className={styles.pairingStatus}>
            {statusDetails}
        </Box>
    );
}

function useStatusDetails(status: BasePairingState["status"]) {
    const { t } = useTranslation();

    switch (status) {
        case "idle":
            return (
                <Badge variant="neutral">
                    {t("wallet.pairing.status.idle")}
                </Badge>
            );
        case "connecting":
            return (
                <Badge variant="warning">
                    <Box as="span" className={styles.statusInline}>
                        <Spinner size="s" />
                        {t("wallet.pairing.status.connecting")}
                    </Box>
                </Badge>
            );
        case "paired":
            return (
                <Badge variant="success">
                    <Box as="span" className={styles.statusInline}>
                        <Check size={16} />
                        {t("wallet.pairing.status.paired")}
                    </Box>
                </Badge>
            );
    }
}
