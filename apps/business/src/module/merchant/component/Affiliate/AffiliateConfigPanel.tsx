import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";

type AffiliateBrand = {
    provider: "takeads";
    externalId: string;
    trackingLink: string;
};

/**
 * Read-only summary of a merchant's affiliate (e.g. TakeAds) brand link,
 * shown on the edit page in place of the SDK identity section — affiliate
 * merchants have no embedded SDK to configure.
 */
export function AffiliateConfigPanel({
    affiliate,
}: {
    affiliate: AffiliateBrand;
}) {
    const { t } = useTranslation();

    return (
        <Card radius="m">
            <Stack space="m">
                <Stack space="xxs">
                    <Text variant="body" weight="medium">
                        {t("merchant.affiliate.title")}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("merchant.affiliate.description")}
                    </Text>
                </Stack>
                <Stack space="xxs">
                    <Text variant="bodySmall" weight="medium" color="secondary">
                        {t("merchant.affiliate.brandId")}
                    </Text>
                    <Input
                        variant="bare"
                        tone="muted"
                        value={affiliate.externalId}
                        readOnly
                    />
                </Stack>
                <Stack space="xxs">
                    <Text variant="bodySmall" weight="medium" color="secondary">
                        {t("merchant.affiliate.trackingLink")}
                    </Text>
                    <Input
                        variant="bare"
                        tone="muted"
                        value={affiliate.trackingLink}
                        readOnly
                    />
                </Stack>
            </Stack>
        </Card>
    );
}
