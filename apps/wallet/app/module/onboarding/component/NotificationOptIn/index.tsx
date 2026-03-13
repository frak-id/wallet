import { Button } from "@frak-labs/ui/component/Button";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StepLayout } from "@/module/common/component/StepLayout";

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
        <StepLayout
            icon={<span>🔔</span>}
            title={t("onboarding.notification.title")}
            description={t("onboarding.notification.description")}
            footer={
                <>
                    <Button
                        width={"full"}
                        disabled={isEnabling}
                        isLoading={isEnabling}
                        onClick={() => {
                            if (isEnabling) return;
                            setIsEnabling(true);
                            onEnable();
                        }}
                    >
                        {t("onboarding.notification.enable")}
                    </Button>
                    <Button
                        variant={"ghost"}
                        width={"full"}
                        size={"medium"}
                        disabled={isEnabling}
                        onClick={onSkip}
                    >
                        {t("onboarding.notification.skip")}
                    </Button>
                </>
            }
        />
    );
}
