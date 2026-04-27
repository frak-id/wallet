import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    BankIcon,
    PersonIcon,
    SafetyIcon,
} from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useConnection } from "wagmi";
import { useMoneriumAuth } from "@/module/monerium/hooks/useMoneriumAuth";
import { FeatureRow } from "./FeatureRow";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumConnectScreenProps = {
    onClose: () => void;
    /**
     * - `"info"` — first-time explanation with 3 feature rows
     * - `"kyc"`  — KYC pending reminder with 1 feature row
     */
    variant: "info" | "kyc";
};

type FeatureConfig = {
    icon: ReactNode;
    titleKey: string;
    descriptionKey: string;
};

const infoFeatures: FeatureConfig[] = [
    {
        icon: <PersonIcon width={24} height={24} />,
        titleKey: "monerium.bankFlow.info.feature1Title",
        descriptionKey: "monerium.bankFlow.info.feature1Description",
    },
    {
        icon: <BankIcon width={24} height={24} />,
        titleKey: "monerium.bankFlow.info.feature2Title",
        descriptionKey: "monerium.bankFlow.info.feature2Description",
    },
    {
        icon: <SafetyIcon width={24} height={24} />,
        titleKey: "monerium.bankFlow.info.feature3Title",
        descriptionKey: "monerium.bankFlow.info.feature3Description",
    },
];

const kycFeatures: FeatureConfig[] = [
    {
        icon: <PersonIcon width={24} height={24} />,
        titleKey: "monerium.bankFlow.kyc.featureTitle",
        descriptionKey: "monerium.bankFlow.kyc.featureDescription",
    },
];

const variantConfig = {
    info: {
        titleKey: "monerium.bankFlow.info.title",
        descriptionKey: "monerium.bankFlow.info.description",
        noticeKey: "monerium.bankFlow.info.redirectNotice",
        ctaKey: "monerium.bankFlow.info.cta",
        features: infoFeatures,
    },
    kyc: {
        titleKey: "monerium.bankFlow.kyc.title",
        descriptionKey: "monerium.bankFlow.kyc.description",
        noticeKey: "monerium.bankFlow.kyc.notice",
        ctaKey: "monerium.bankFlow.kyc.cta",
        features: kycFeatures,
    },
} as const;

/**
 * Shared screen for both the initial Monerium info and the KYC-pending
 * reminder.  Both redirect to Monerium OAuth on CTA click; only the
 * copy and feature list differ.
 */
export function MoneriumConnectScreen({
    onClose,
    variant,
}: MoneriumConnectScreenProps) {
    const { t } = useTranslation();
    const { address } = useConnection();
    const { connect, isConnecting } = useMoneriumAuth();
    const config = variantConfig[variant];

    const handleConnect = () => {
        if (address) connect(address);
    };

    return (
        <MoneriumScreen
            onClose={onClose}
            title={t(config.titleKey)}
            ctaLabel={t(config.ctaKey)}
            ctaOnClick={handleConnect}
            ctaLoading={isConnecting}
        >
            <Stack space="m">
                <Text variant="body" color="secondary">
                    {t(config.descriptionKey)}
                </Text>
                <Text variant="body" color="secondary">
                    {t(config.noticeKey)}
                </Text>
            </Stack>

            <Card variant="elevated" padding="none">
                <Stack space="none">
                    {config.features.map((feature) => (
                        <FeatureRow
                            key={feature.titleKey}
                            icon={feature.icon}
                            title={t(feature.titleKey)}
                            description={t(feature.descriptionKey)}
                        />
                    ))}
                </Stack>
            </Card>
        </MoneriumScreen>
    );
}
