import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { Trans, useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { HeroContent } from "../HeroContent";
import * as slideStyles from "../slides/index.css";
import welcomeImg from "./welcome.webp";

type WelcomeProps = {
    onContinue: () => void;
};

export function Welcome({ onContinue }: WelcomeProps) {
    const { t } = useTranslation();

    return (
        <PageLayout
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
                                        // biome-ignore lint/a11y/useAnchorContent: Content provided by Trans i18n component
                                        <a
                                            href="https://frak.id/privacy"
                                            target="_blank"
                                            rel="noreferrer"
                                        />
                                    ),
                                    privacyLink: (
                                        // biome-ignore lint/a11y/useAnchorContent: Content provided by Trans i18n component
                                        <a
                                            href="https://frak.id/privacy"
                                            target="_blank"
                                            rel="noreferrer"
                                        />
                                    ),
                                }}
                            />
                        </Text>
                    </Box>
                </>
            }
        >
            <div className={slideStyles.slide}>
                <HeroContent
                    image={<img src={welcomeImg} alt="" />}
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
