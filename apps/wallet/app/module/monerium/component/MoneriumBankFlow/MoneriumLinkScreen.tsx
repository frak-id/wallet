import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { LinkIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { useMoneriumLinkWallet } from "@/module/monerium/hooks/useMoneriumLinkWallet";
import { FeatureRow } from "./FeatureRow";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumLinkScreenProps = {
    onClose: () => void;
};

export function MoneriumLinkScreen({ onClose }: MoneriumLinkScreenProps) {
    const { t } = useTranslation();
    const { linkWallet, isPending } = useMoneriumLinkWallet();

    return (
        <MoneriumScreen
            onClose={onClose}
            title={t("monerium.bankFlow.link.title")}
            ctaLabel={t("monerium.bankFlow.link.cta")}
            ctaOnClick={() => linkWallet()}
            ctaLoading={isPending}
        >
            <Text variant="body" color="secondary">
                {t("monerium.bankFlow.link.description")}
            </Text>

            <Card variant="elevated" padding="none">
                <Stack space="none">
                    <FeatureRow
                        icon={<LinkIcon width={24} height={24} />}
                        title={t("monerium.bankFlow.link.featureTitle")}
                        description={t(
                            "monerium.bankFlow.link.featureDescription"
                        )}
                    />
                </Stack>
            </Card>
        </MoneriumScreen>
    );
}
