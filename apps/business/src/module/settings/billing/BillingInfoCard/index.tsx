import { Box } from "@frak-labs/design-system/components/Box";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { WarningCircleIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { DetailRow, DetailValue } from "@/module/common/component/DetailRow";
import { getCountryName } from "@/module/common/utils/countries";
import { SettingsCard } from "../../SettingsCard";
import { BillingInfoSheet } from "../BillingInfoSheet";
import { useBillingInfo } from "../useBillingInfo";
import * as styles from "./billing-info-card.css";

/**
 * Invoice-informations card. Empty state shows a "Missing infos" warning and an
 * "Add" action; once saved it shows the billing summary rows and an "Edit" action.
 */
export function BillingInfoCard() {
    const { t } = useTranslation();
    const { info, saveInfo } = useBillingInfo();

    if (!info) {
        return (
            <SettingsCard>
                <Stack space="m">
                    <DetailRow label={t("settings.billing.info.label")}>
                        <Inline space="xxs" alignY="center" wrap={false}>
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                color="warning"
                            >
                                {t("settings.billing.info.missing")}
                            </Text>
                            <WarningCircleIcon
                                width={16}
                                height={16}
                                className={styles.warningIcon}
                            />
                        </Inline>
                    </DetailRow>
                    <div>
                        <BillingInfoSheet mode="add" onSave={saveInfo} />
                    </div>
                </Stack>
            </SettingsCard>
        );
    }

    return (
        <SettingsCard>
            <Stack space="m">
                <Stack space="xxs">
                    <Text
                        as="span"
                        variant="bodySmall"
                        weight="medium"
                        color="secondary"
                    >
                        {t("settings.billing.info.title")}
                    </Text>
                    <Text variant="caption" color="tertiary">
                        {t("settings.billing.info.subtitle")}
                    </Text>
                </Stack>
                <Box paddingX="m">
                    <DetailRow
                        label={t("settings.billing.summary.companyName")}
                    >
                        <DetailValue>{info.companyName}</DetailValue>
                    </DetailRow>
                    <DetailRow label={t("settings.billing.summary.vatNumber")}>
                        <DetailValue>{info.vatNumber}</DetailValue>
                    </DetailRow>
                    <DetailRow
                        label={t("settings.billing.summary.address")}
                        tall
                    >
                        <Stack space="none" align="right">
                            <DetailValue>{info.streetAddress}</DetailValue>
                            <DetailValue>
                                {info.postalCode}, {info.city}
                            </DetailValue>
                        </Stack>
                    </DetailRow>
                    <DetailRow label={t("settings.billing.summary.country")}>
                        <DetailValue>
                            {getCountryName(info.country)}
                        </DetailValue>
                    </DetailRow>
                    <DetailRow
                        label={t("settings.billing.summary.billingEmail")}
                    >
                        <DetailValue>{info.billingEmail}</DetailValue>
                    </DetailRow>
                </Box>
                <div>
                    <BillingInfoSheet
                        mode="edit"
                        info={info}
                        onSave={saveInfo}
                    />
                </div>
            </Stack>
        </SettingsCard>
    );
}
