import { Button } from "@frak-labs/design-system/components/Button";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import * as stepStyles from "../step/index.css";
import {
    OnboardingHero,
    type OnboardingHeroProps,
} from "../step/OnboardingHero";

type OnboardingStepProps = {
    /** Hero content for this step */
    hero: OnboardingHeroProps;
    /** Primary CTA label */
    buttonLabel: string;
    /** Called when the user clicks the primary CTA */
    onContinue: () => void;
    /** Optional back handler — when set, renders a Back arrow top-left */
    onBack?: () => void;
    /** Optional label for the secondary login link */
    loginLabel?: string;
    /** Called when the user clicks the login link */
    onLoginClick?: () => void;
    /** Whether the login action is in progress */
    isLoginLoading?: boolean;
    /** Called when the user clicks the recovery code link */
    onRecoveryCodeClick?: () => void;
};

export function OnboardingStep({
    hero,
    buttonLabel,
    onContinue,
    onBack,
    loginLabel,
    onLoginClick,
    isLoginLoading,
    onRecoveryCodeClick,
}: OnboardingStepProps) {
    const { t } = useTranslation();

    return (
        <PageLayout
            fixedViewport
            back={onBack ? <Back onClick={onBack} /> : undefined}
            footer={
                <>
                    <Button onClick={onContinue}>{buttonLabel}</Button>
                    {loginLabel && onLoginClick && (
                        <Button
                            variant="secondary"
                            onClick={onLoginClick}
                            loading={isLoginLoading}
                        >
                            {loginLabel}
                        </Button>
                    )}
                    {onRecoveryCodeClick && (
                        <Button
                            size="small"
                            variant="ghost"
                            onClick={onRecoveryCodeClick}
                        >
                            {t("onboarding.recoveryCode")}
                        </Button>
                    )}
                </>
            }
        >
            <div className={stepStyles.body}>
                <OnboardingHero {...hero} />
            </div>
        </PageLayout>
    );
}
