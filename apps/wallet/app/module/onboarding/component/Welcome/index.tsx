import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { ExternalLink } from "@frak-labs/wallet-shared";
import { Trans, useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { HeroContent } from "../HeroContent";
import * as stepStyles from "../step/index.css";
import welcomeImg from "./welcome.webp";

type WelcomeProps = {
    onContinue: () => void;
};

export function Welcome({ onContinue }: WelcomeProps) {
    const { t } = useTranslation();

    return (
        <PageLayout
            fixedViewport
            footer={
                <>
                    <Button onClick={onContinue}>
                        {t("onboarding.welcome.button")}
                    </Button>
                    <Box textAlign="center">
                        <Text variant="caption">
                            <Trans
                                i18nKey="onboarding.welcome.legal"
                                components={{
                                    termsLink: (
                                        <ExternalLink href="https://frak.id/privacy" />
                                    ),
                                    privacyLink: (
                                        <ExternalLink href="https://frak.id/privacy" />
                                    ),
                                }}
                            />
                        </Text>
                    </Box>
                </>
            }
        >
            <div className={stepStyles.body}>
                <HeroContent
                    bleed
                    image={
                        <img
                            src={welcomeImg}
                            alt=""
                            className={stepStyles.heroImageCenter}
                        />
                    }
                    title={t("onboarding.welcome.title")}
                    description={
                        <Box display="flex" flexDirection="column" gap="m">
                            <Text>{t("onboarding.welcome.description")}</Text>
                            <Text>
                                {t("onboarding.welcome.descriptionHighlight")}
                            </Text>
                        </Box>
                    }
                />
            </div>
        </PageLayout>
    );
}
