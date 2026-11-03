import { LinkIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { useMoneriumLinkWallet } from "@/module/monerium/hooks/useMoneriumLinkWallet";
import { FeatureList } from "./FeatureRow";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumLinkScreenProps = {
    onClose: () => void;
};

export function MoneriumLinkScreen({ onClose }: MoneriumLinkScreenProps) {
    const { t } = useTranslation();
    const { linkWallet, isPending, error } = useMoneriumLinkWallet();

    return (
        <MoneriumScreen
            onClose={onClose}
            title={t("monerium.bankFlow.link.title")}
            description={t("monerium.bankFlow.link.description")}
            error={error}
            ctaLabel={t("monerium.bankFlow.link.cta")}
            ctaOnClick={() => linkWallet()}
            ctaLoading={isPending}
        >
            <FeatureList
                features={[
                    {
                        icon: <LinkIcon width={24} height={24} />,
                        title: t("monerium.bankFlow.link.featureTitle"),
                        description: t(
                            "monerium.bankFlow.link.featureDescription"
                        ),
                    },
                ]}
            />
        </MoneriumScreen>
    );
}
