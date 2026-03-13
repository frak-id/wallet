import { Button } from "@frak-labs/ui/component/Button";
import { useTranslation } from "react-i18next";
import { StepLayout } from "@/module/common/component/StepLayout";

type WelcomeProps = {
    onContinue: () => void;
};

export function Welcome({ onContinue }: WelcomeProps) {
    const { t } = useTranslation();

    return (
        <StepLayout
            icon={<span>🎉</span>}
            title={t("onboarding.welcome.title")}
            description={t("onboarding.welcome.description")}
            footer={
                <Button width={"full"} size={"medium"} onClick={onContinue}>
                    {t("onboarding.welcome.button")}
                </Button>
            }
        />
    );
}
