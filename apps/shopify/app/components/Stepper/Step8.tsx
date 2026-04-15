import type { loader as rootLoader } from "app/routes/app";
import {
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import { Trans, useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import { ExternalButton } from "../ui/ExternalLink";
import { CollapsibleStep } from "./CollapsibleStep";

export function Step8({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { isCheckoutExtensionActive } = onboardingData;
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const checkoutEditorUrl = `https://${rootData?.shop?.myshopifyDomain}/admin/settings/checkout/editor?page=thank-you&context=apps`;
    const isCompleted = !!isCheckoutExtensionActive;
    const { failedSteps } = validateCompleteOnboarding(onboardingData);

    return (
        <CollapsibleStep
            step={8}
            currentStep={failedSteps[0]}
            completed={isCompleted}
            title={t("stepper.step8.title")}
        >
            <s-text>
                <Trans i18nKey="stepper.step8.description" />
            </s-text>
            <ExternalButton variant="primary" href={checkoutEditorUrl}>
                {t("stepper.step8.link")}
            </ExternalButton>
        </CollapsibleStep>
    );
}
