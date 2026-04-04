import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import { PersonIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { useMoneriumAuth } from "@/module/monerium/hooks/useMoneriumAuth";
import { FeatureRow } from "./FeatureRow";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumKycScreenProps = {
    onClose: () => void;
};

/**
 * Shown when the user is connected to Monerium but KYC is
 * not yet complete (profile state "created" or "pending").
 *
 * CTA redirects back to Monerium so the user can finish verification.
 */
export function MoneriumKycScreen({ onClose }: MoneriumKycScreenProps) {
    const { t } = useTranslation();
    const { address } = useAccount();
    const { connect, isConnecting } = useMoneriumAuth();

    const handleVerify = () => {
        if (address) connect(address);
    };

    return (
        <MoneriumScreen
            onClose={onClose}
            ctaLabel={t("monerium.bankFlow.kyc.cta")}
            ctaOnClick={handleVerify}
            ctaLoading={isConnecting}
        >
            {/* Title + description */}
            <Box display={"flex"} flexDirection={"column"} gap={"s"}>
                <Text variant="heading1">
                    {t("monerium.bankFlow.kyc.title")}
                </Text>
                <Text variant="body" color="secondary">
                    {t("monerium.bankFlow.kyc.description")}
                </Text>
                <Text variant="body" color="secondary">
                    {t("monerium.bankFlow.kyc.notice")}
                </Text>
            </Box>

            {/* Single feature card */}
            <Card variant="muted" padding="default">
                <FeatureRow
                    icon={<PersonIcon width={20} height={20} />}
                    title={t("monerium.bankFlow.kyc.featureTitle")}
                    description={t("monerium.bankFlow.kyc.featureDescription")}
                />
            </Card>
        </MoneriumScreen>
    );
}
