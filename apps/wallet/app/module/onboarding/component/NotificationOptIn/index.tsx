import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Overlay } from "@frak-labs/design-system/components/Overlay";
import { Text } from "@frak-labs/design-system/components/Text";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { HeroContent } from "../HeroContent";
import * as slideStyles from "../slides/index.css";
import notificationImg from "./notification.png";

type NotificationOptInProps = {
    onEnable: () => void;
    onSkip: () => void;
};

export function NotificationOptIn({
    onEnable,
    onSkip,
}: NotificationOptInProps) {
    const { t } = useTranslation();
    const [isEnabling, setIsEnabling] = useState(false);

    return (
        <PageLayout
            footer={
                <>
                    <Button
                        disabled={isEnabling}
                        onClick={() => {
                            if (isEnabling) return;
                            setIsEnabling(true);
                            onEnable();
                        }}
                    >
                        {t("onboarding.notification.enable")}
                    </Button>
                    <Button
                        variant="secondary"
                        disabled={isEnabling}
                        onClick={onSkip}
                    >
                        {t("onboarding.notification.skip")}
                    </Button>
                </>
            }
        >
            {isEnabling && <Overlay />}
            <div className={slideStyles.slide}>
                <HeroContent
                    image={<img src={notificationImg} alt="" />}
                    title={t("onboarding.notification.title")}
                    description={
                        <Box display="flex" flexDirection="column" gap="m">
                            <Text>
                                {t("onboarding.notification.description")}
                            </Text>
                            <Text>
                                {t(
                                    "onboarding.notification.descriptionHighlight"
                                )}
                            </Text>
                        </Box>
                    }
                />
            </div>
        </PageLayout>
    );
}
