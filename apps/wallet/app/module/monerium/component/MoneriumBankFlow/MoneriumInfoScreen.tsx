import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import { PersonIcon } from "@frak-labs/design-system/icons";
import { Landmark, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { useMoneriumAuth } from "@/module/monerium/hooks/useMoneriumAuth";
import { FeatureRow } from "./FeatureRow";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumInfoScreenProps = {
    onClose: () => void;
};

/**
 * First screen of the bank-transfer flow.
 *
 * Explains what Monerium does (identity, IBAN, security) and
 * redirects to the Monerium OAuth flow on CTA click.
 */
export function MoneriumInfoScreen({ onClose }: MoneriumInfoScreenProps) {
    const { t } = useTranslation();
    const { address } = useAccount();
    const { connect, isConnecting } = useMoneriumAuth();

    const handleAccept = () => {
        if (address) connect(address);
    };

    return (
        <MoneriumScreen
            onClose={onClose}
            ctaLabel={t("monerium.bankFlow.info.cta")}
            ctaOnClick={handleAccept}
            ctaLoading={isConnecting}
        >
            {/* Title + description */}
            <Box display={"flex"} flexDirection={"column"} gap={"s"}>
                <Text variant="heading1">
                    {t("monerium.bankFlow.info.title")}
                </Text>
                <Text variant="body" color="secondary">
                    {t("monerium.bankFlow.info.description")}
                </Text>
                <Text variant="body" color="secondary">
                    {t("monerium.bankFlow.info.redirectNotice")}
                </Text>
            </Box>

            {/* Feature list */}
            <Card variant="muted" padding="default">
                <Box display={"flex"} flexDirection={"column"} gap={"l"}>
                    <FeatureRow
                        icon={<PersonIcon width={20} height={20} />}
                        title={t("monerium.bankFlow.info.feature1Title")}
                        description={t(
                            "monerium.bankFlow.info.feature1Description"
                        )}
                    />
                    <FeatureRow
                        icon={<Landmark size={20} />}
                        title={t("monerium.bankFlow.info.feature2Title")}
                        description={t(
                            "monerium.bankFlow.info.feature2Description"
                        )}
                    />
                    <FeatureRow
                        icon={<ShieldCheck size={20} />}
                        title={t("monerium.bankFlow.info.feature3Title")}
                        description={t(
                            "monerium.bankFlow.info.feature3Description"
                        )}
                    />
                </Box>
            </Card>
        </MoneriumScreen>
    );
}
