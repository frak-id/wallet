import { Text } from "@frak-labs/design-system/components/Text";
import type { TargetPairingState } from "@frak-labs/wallet-shared/pairing/types";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { PairingStatus } from "@/module/pairing/component/PairingStatus";

export function PairingInfo({
    status,
    originName,
}: {
    status: TargetPairingState["status"];
    originName?: string;
}) {
    const { t } = useTranslation();

    return (
        <InfoCard variant="muted">
            <InfoRow
                label={t("wallet.pairing.info.title")}
                labelVariant="bodySmall"
                labelColor="secondary"
            />
            <InfoRow
                label={t("wallet.pairing.info.status")}
                labelVariant="bodySmall"
                labelColor="secondary"
                action={<PairingStatus status={status} />}
            />
            {originName && (
                <InfoRow
                    label={t("wallet.pairing.info.device")}
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    action={
                        <Text as="span" variant="bodySmall" weight="medium">
                            {originName}
                        </Text>
                    }
                />
            )}
        </InfoCard>
    );
}
