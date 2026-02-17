import type { loader as rootLoader } from "app/routes/app";
import {
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import { Trans, useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import screenFrakListener from "../../assets/frak-listener.png";
import { CollapsibleStep } from "./CollapsibleStep";

export function Step5({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { theme, isThemeHasFrakActivated } = onboardingData;
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const { id } = theme || {};
    const editorUrl = `https://${rootData?.shop?.myshopifyDomain}/admin/themes/current/editor`;
    const isFrakActivated = !!isThemeHasFrakActivated;
    const { failedSteps } = validateCompleteOnboarding(onboardingData);

    return (
        <CollapsibleStep
            step={5}
            completed={isFrakActivated}
            title={t("stepper.step5.title")}
            currentStep={failedSteps[0]}
        >
            <s-text>
                <Trans i18nKey="stepper.step5.description" />
            </s-text>
            <img src={screenFrakListener} alt="" />
            <s-button
                variant="primary"
                href={`${editorUrl}?context=apps&appEmbed=${id}/listener`}
                target="_blank"
            >
                {t("stepper.step5.link")}
            </s-button>
        </CollapsibleStep>
    );
}
