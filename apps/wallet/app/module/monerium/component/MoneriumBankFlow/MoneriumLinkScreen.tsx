import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import { Link } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMoneriumLinkWallet } from "@/module/monerium/hooks/useMoneriumLinkWallet";
import { FeatureRow } from "./FeatureRow";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumLinkScreenProps = {
    onClose: () => void;
};

/**
 * Shown when the user has completed KYC but their wallet
 * is not yet linked to the Monerium account.
 *
 * CTA triggers the wallet-linking flow (sign message + API call).
 */
export function MoneriumLinkScreen({ onClose }: MoneriumLinkScreenProps) {
    const { t } = useTranslation();
    const { linkWallet, isPending } = useMoneriumLinkWallet();

    return (
        <MoneriumScreen
            onClose={onClose}
            ctaLabel={t("monerium.bankFlow.link.cta")}
            ctaOnClick={() => linkWallet()}
            ctaLoading={isPending}
        >
            {/* Title + description */}
            <Box display={"flex"} flexDirection={"column"} gap={"s"}>
                <Text variant="heading1">
                    {t("monerium.bankFlow.link.title")}
                </Text>
                <Text variant="body" color="secondary">
                    {t("monerium.bankFlow.link.description")}
                </Text>
            </Box>

            {/* Single feature card */}
            <Card variant="muted" padding="default">
                <FeatureRow
                    icon={<Link size={20} />}
                    title={t("monerium.bankFlow.link.featureTitle")}
                    description={t("monerium.bankFlow.link.featureDescription")}
                />
            </Card>
        </MoneriumScreen>
    );
}
