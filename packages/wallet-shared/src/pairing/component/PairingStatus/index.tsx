import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { TFunction } from "i18next";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BasePairingState } from "../../types";

export function PairingStatus({
    status,
}: {
    status: BasePairingState["status"];
}) {
    const { t } = useTranslation();
    const statusDetails = getStatusDetails(t, status);

    return statusDetails;
}

function getStatusDetails(t: TFunction, status: BasePairingState["status"]) {
    switch (status) {
        case "idle":
            return t("wallet.pairing.status.idle");
        case "connecting":
            return (
                <Stack space="xs" align="center">
                    <Spinner />
                    <Text variant="bodySmall" weight="medium">
                        {t("wallet.pairing.status.connecting")}
                    </Text>
                </Stack>
            );
        case "paired":
            return (
                <Stack space="xs" align="center">
                    <Check color="green" size={16} />
                    <Text variant="bodySmall" weight="medium">
                        {t("wallet.pairing.status.paired")}
                    </Text>
                </Stack>
            );
    }
}
