import type { AffiliateBrandInfo } from "@frak-labs/backend-elysia/api/schemas";
import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";

/**
 * Read-only summary of a merchant's affiliate (e.g. TakeAds) brand link,
 * shown on the edit page in place of the SDK identity section — affiliate
 * merchants have no embedded SDK to configure.
 */
export function AffiliateConfigPanel({
    affiliate,
}: {
    affiliate: AffiliateBrandInfo;
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
                <Input
                    variant="bare"
                    tone="muted"
                    label={t("merchant.affiliate.brandId")}
                    value={affiliate.externalId}
                    readOnly
                />
                <Input
                    variant="bare"
                    tone="muted"
                    label={t("merchant.affiliate.trackingLink")}
                    value={affiliate.trackingLink}
                    readOnly
                />
            </Stack>
        </Card>
    );
}
