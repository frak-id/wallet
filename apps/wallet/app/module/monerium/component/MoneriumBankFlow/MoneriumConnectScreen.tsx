import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    BankIcon,
    PersonIcon,
    SafetyIcon,
} from "@frak-labs/design-system/icons";
import type { DefaultTranslationKey } from "@frak-labs/wallet-shared/types";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMoneriumConnect } from "@/module/monerium/hooks/useMoneriumConnect";
import { getMoneriumErrorKey } from "@/module/monerium/utils/moneriumErrors";
import { FeatureRow } from "./FeatureRow";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumConnectScreenProps = {
    onClose: () => void;
    /**
     * - `"info"`       first-time explanation, with a secondary "I already have an account"
     * - `"reconnect"`  the Monerium session expired
     * - `"onboarding"` connected, but the profile is not complete on Monerium yet
     */
    variant: "info" | "reconnect" | "onboarding";
};

type FeatureConfig = {
    icon: ReactNode;
    titleKey: DefaultTranslationKey;
    descriptionKey: DefaultTranslationKey;
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

const onboardingFeatures: FeatureConfig[] = [
    {
        icon: <PersonIcon width={24} height={24} />,
        titleKey: "monerium.bankFlow.kyc.featureTitle",
        descriptionKey: "monerium.bankFlow.kyc.featureDescription",
    },
];

type VariantConfig = {
    titleKey: DefaultTranslationKey;
    descriptionKey: DefaultTranslationKey;
    noticeKey?: DefaultTranslationKey;
    ctaKey: DefaultTranslationKey;
    features: FeatureConfig[];
};

const variantConfig: Record<
    MoneriumConnectScreenProps["variant"],
    VariantConfig
> = {
    info: {
        titleKey: "monerium.bankFlow.info.title",
        descriptionKey: "monerium.bankFlow.info.description",
        noticeKey: "monerium.bankFlow.info.redirectNotice",
        ctaKey: "monerium.bankFlow.info.cta",
        features: infoFeatures,
    },
    reconnect: {
        titleKey: "monerium.bankFlow.reconnect.title",
        descriptionKey: "monerium.bankFlow.reconnect.description",
        ctaKey: "monerium.bankFlow.reconnect.cta",
        features: [],
    },
    onboarding: {
        titleKey: "monerium.bankFlow.kyc.title",
        descriptionKey: "monerium.bankFlow.kyc.description",
        noticeKey: "monerium.bankFlow.kyc.notice",
        ctaKey: "monerium.bankFlow.kyc.cta",
        features: onboardingFeatures,
    },
};

/**
 * Screen that sends the user to Monerium: a first connection, a reconnect
 * after the session expired, or finishing the onboarding there.
 */
export function MoneriumConnectScreen({
    onClose,
    variant,
}: MoneriumConnectScreenProps) {
    const { t } = useTranslation();
    const { connect, isConnecting, error } = useMoneriumConnect();
    const config = variantConfig[variant];

    return (
        <MoneriumScreen
            onClose={onClose}
            title={t(config.titleKey)}
            ctaLabel={t(config.ctaKey)}
            ctaOnClick={() => connect({})}
            ctaLoading={isConnecting}
            secondaryLabel={
                variant === "info"
                    ? t("monerium.bankFlow.info.secondaryCta")
                    : undefined
            }
            secondaryOnClick={
                variant === "info"
                    ? () => connect({ authMode: "login" })
                    : undefined
            }
        >
            <Stack space="m">
                <Text variant="body" color="secondary">
                    {t(config.descriptionKey)}
                </Text>
                {config.noticeKey ? (
                    <Text variant="body" color="secondary">
                        {t(config.noticeKey)}
                    </Text>
                ) : null}
            </Stack>

            {config.features.length > 0 ? (
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
            ) : null}

            {error ? (
                <Text variant="bodySmall" color="error">
                    {t(getMoneriumErrorKey(error))}
                </Text>
            ) : null}
        </MoneriumScreen>
    );
}
