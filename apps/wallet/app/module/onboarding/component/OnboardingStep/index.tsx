import { Button } from "@frak-labs/design-system/components/Button";
import { HandleErrors } from "@frak-labs/wallet-shared";
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
    /** Login error surfaced above the actions (login-enabled step only) */
    loginError?: Error | null;
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
    loginError,
    onRecoveryCodeClick,
}: OnboardingStepProps) {
    const { t } = useTranslation();

    return (
        <PageLayout
            fixedViewport
            back={onBack ? <Back onClick={() => onBack()} /> : undefined}
            footer={
                <>
                    {loginError && (
                        <HandleErrors error={loginError} operation="login" />
                    )}
                    <Button onClick={() => onContinue()}>{buttonLabel}</Button>
                    {loginLabel && onLoginClick && (
                        <Button
                            variant="secondary"
                            onClick={() => onLoginClick()}
                            loading={isLoginLoading}
                        >
                            {loginLabel}
                        </Button>
                    )}
                    {onRecoveryCodeClick && (
                        <Button
                            size="small"
                            variant="ghost"
                            onClick={() => onRecoveryCodeClick()}
                        >
                            {t("onboarding.recoveryCode")}
                        </Button>
                    )}
                </>
            }
        >
            <div
                className={
                    onBack
                        ? `${stepStyles.body} ${stepStyles.bodyWithBack}`
                        : stepStyles.body
                }
            >
                <OnboardingHero {...hero} />
            </div>
        </PageLayout>
    );
}
