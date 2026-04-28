import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { PairingDevices } from "@/module/pairing/component/PairingDevices";

export function PairingHeader() {
    const { t } = useTranslation();

    return (
        <Stack space="m">
            <Text as="h1" variant="heading1">
                {t("wallet.pairing.title")}
            </Text>
            <Text as="p" color="secondary">
                {t("wallet.pairing.text")}
            </Text>
            <PairingDevices />
        </Stack>
    );
}
