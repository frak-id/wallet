import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Overlay } from "@frak-labs/design-system/components/Overlay";
import { Text } from "@frak-labs/design-system/components/Text";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { HeroContent } from "../HeroContent";
import * as stepStyles from "../step/index.css";
import notificationImg from "./notification.webp";

type NotificationOptInProps = {
    onEnable: () => void;
    /**
     * Header-end slot, right-aligned on the header row. Required: this screen
     * has no back affordance and its footer holds only the enable CTA, so the
     * skip is the only way out.
     */
    headerEnd: ReactNode;
    /**
     * Reports whether the subscribe call is in flight, so the parent can
     * disable the header skip while it runs.
     */
    onBusyChange?: (isBusy: boolean) => void;
};

export function NotificationOptIn({
    onEnable,
    headerEnd,
    onBusyChange,
}: NotificationOptInProps) {
    const { t } = useTranslation();
    const [isEnabling, setIsEnabling] = useState(false);

    // Clear on unmount too: leaving mid-subscribe would otherwise strand the
    // parent's flag at `true` and disable the next step's skip.
    useEffect(() => {
        onBusyChange?.(isEnabling);
        return () => onBusyChange?.(false);
    }, [isEnabling, onBusyChange]);

    return (
        <PageLayout
            fixedViewport
            headerEnd={headerEnd}
            footer={
                <Button
                    loading={isEnabling}
                    onClick={() => {
                        if (isEnabling) return;
                        setIsEnabling(true);
                        onEnable();
                    }}
                >
                    {t("onboarding.notification.enable")}
                </Button>
            }
        >
            {isEnabling && <Overlay />}
            <div className={stepStyles.body}>
                <HeroContent
                    image={
                        <img
                            src={notificationImg}
                            alt=""
                            className={stepStyles.heroImageCenter}
                            // Natural 2x size — reserves aspect ratio so lazy
                            // loading doesn't shift layout; CSS constrains display.
                            width={786}
                            height={700}
                            loading="lazy"
                            decoding="async"
                        />
                    }
                    title={t("onboarding.notification.title")}
                    description={
                        <Box display="flex" flexDirection="column" gap="m">
                            <Text>
                                {t("onboarding.notification.description")}
                            </Text>
                        </Box>
                    }
                />
            </div>
        </PageLayout>
    );
}
