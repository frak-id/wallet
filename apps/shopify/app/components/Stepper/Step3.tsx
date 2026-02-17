import {
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import { useTranslation } from "react-i18next";
import { CreateShopifyWebhook } from "../Webhook";
import { CollapsibleStep } from "./CollapsibleStep";

export function Step3({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { webhooks } = onboardingData;
    const { t } = useTranslation();
    const isWebhookExists = Boolean(webhooks?.length);
    const { failedSteps } = validateCompleteOnboarding(onboardingData);

    return (
        <CollapsibleStep
            step={3}
            currentStep={failedSteps[0]}
            completed={isWebhookExists}
            title={t("stepper.step3.title")}
            description={t("stepper.step3.description")}
        >
            {!isWebhookExists && <CreateShopifyWebhook />}
        </CollapsibleStep>
    );
}
