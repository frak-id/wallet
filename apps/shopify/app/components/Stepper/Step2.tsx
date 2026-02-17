import {
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import { useTranslation } from "react-i18next";
import { Pixel } from "../Pixel";
import { CollapsibleStep } from "./CollapsibleStep";

export function Step2({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { webPixel } = onboardingData;
    const { t } = useTranslation();
    const isPixelConnected = !!webPixel?.id;
    const { failedSteps } = validateCompleteOnboarding(onboardingData);

    return (
        <CollapsibleStep
            step={2}
            currentStep={failedSteps[0]}
            completed={isPixelConnected}
            title={t("stepper.step2.title")}
            description={t("stepper.step2.description")}
        >
            {!isPixelConnected && <Pixel id={webPixel?.id} />}
        </CollapsibleStep>
    );
}
