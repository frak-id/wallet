import type { loader as rootLoader } from "app/routes/app";
import {
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import { Trans, useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import { ExternalButton } from "../ui/ExternalLink";
import { CollapsibleStep } from "./CollapsibleStep";

export function Step7({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { isThemeHasFrakBanner, theme } = onboardingData;
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const editorUrl = `https://${rootData?.shop?.myshopifyDomain}/admin/themes/current/editor`;
    const isCompleted = !!isThemeHasFrakBanner;
    const { failedSteps } = validateCompleteOnboarding(onboardingData);

    return (
        <CollapsibleStep
            step={7}
            currentStep={failedSteps[0]}
            completed={isCompleted}
            title={t("stepper.step7.title")}
        >
            <s-text>
                <Trans i18nKey="stepper.step7.description" />
            </s-text>
            <ExternalButton
                variant="primary"
                href={`${editorUrl}?context=apps&appEmbed=${theme?.id}/banner`}
            >
                {t("stepper.step7.link")}
            </ExternalButton>
        </CollapsibleStep>
    );
}
