import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useGetActivePairings } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Title } from "@/module/common/component/Title";
import { DeviceCard } from "./DeviceCard";

export function ConnectedDevicesPage() {
    const { t } = useTranslation();
    const { data: pairings } = useGetActivePairings();

    return (
        <Stack space="xs">
            <Stack space="m">
                <Back href="/profile" />
                <Title size="page">{t("wallet.pairing.list.title")}</Title>
            </Stack>

            {pairings?.length ? (
                <Stack space="m">
                    {pairings.map((pairing) => (
                        <DeviceCard key={pairing.pairingId} pairing={pairing} />
                    ))}
                </Stack>
            ) : (
                <Text variant="body" color="secondary">
                    {t("wallet.pairing.list.empty")}
                </Text>
            )}
        </Stack>
    );
}
