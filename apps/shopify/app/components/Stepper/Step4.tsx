import {
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import { useTranslation } from "react-i18next";
import { FrakWebhook } from "../Webhook";
import { CollapsibleStep } from "./CollapsibleStep";

export function Step4({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { frakWebhook, merchantId } = onboardingData;
    const { t } = useTranslation();
    const isFrakWebhookExists = frakWebhook?.setup;
    const { failedSteps } = validateCompleteOnboarding(onboardingData);

    return (
        <CollapsibleStep
            step={4}
            currentStep={failedSteps[0]}
            completed={!!isFrakWebhookExists}
            title={t("stepper.step4.title")}
            description={t("stepper.step4.description")}
        >
            {!isFrakWebhookExists && merchantId && (
                <FrakWebhook setup={false} merchantId={merchantId} />
            )}
        </CollapsibleStep>
    );
}
