import { ProgressBar } from "app/components/ui/ProgressBar";
import { useVisibilityChange } from "app/hooks/useVisibilityChange";
import type { loader as appLoader } from "app/routes/app";
import {
    applicableStepCount,
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import type { ReactNode } from "react";
import { Suspense, useCallback, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Await, useNavigate, useRouteLoaderData } from "react-router";
import { useRefreshData } from "../../hooks/useRefreshData";
import { Step1 } from "./Step1";
import { Step2 } from "./Step2";
import { Step3 } from "./Step3";
import { Step4 } from "./Step4";
import { Step5 } from "./Step5";
import { Step6 } from "./Step6";
import { Step7 } from "./Step7";
import { UncheckedIcon } from "./UncheckedIcon";

export function Stepper({ redirectToApp }: { redirectToApp: boolean }) {
    const refresh = useRefreshData();
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    const onboardingDataPromise = rootData?.onboardingDataPromise;
    const isThemeSupportedPromise = rootData?.isThemeSupportedPromise;

    useVisibilityChange(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    return (
        <s-section>
            <s-box paddingBlockEnd="base">
                <s-heading>{t("stepper.title")}</s-heading>
            </s-box>

            <s-stack gap="large-200">
                <Suspense>
                    <Await resolve={onboardingDataPromise}>
                        {(onboardingData) => {
                            if (!onboardingData) return null;
                            return (
                                <Suspense>
                                    <Await
                                        resolve={isThemeSupportedPromise}
                                        errorElement={null}
                                    >
                                        {(isThemeSupported) => (
                                            <>
                                                <StepsIntroduction
                                                    onboardingData={
                                                        onboardingData
                                                    }
                                                    redirectToApp={
                                                        redirectToApp
                                                    }
                                                    isThemeSupported={
                                                        isThemeSupported ?? true
                                                    }
                                                />
                                                <Steps
                                                    onboardingData={
                                                        onboardingData
                                                    }
                                                    isThemeSupported={
                                                        isThemeSupported ?? true
                                                    }
                                                />
                                            </>
                                        )}
                                    </Await>
                                </Suspense>
                            );
                        }}
                    </Await>
                </Suspense>
                <StepsFooter />
            </s-stack>
        </s-section>
    );
}

function StepsIntroduction({
    onboardingData,
    redirectToApp,
    isThemeSupported,
}: {
    onboardingData: OnboardingStepData;
    redirectToApp: boolean;
    isThemeSupported: boolean;
}) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { completedSteps, hasMissedCriticalSteps } =
        validateCompleteOnboarding(onboardingData, isThemeSupported);
    // Legacy themes only show steps 1–4. Count only completed steps within the
    // applicable set (the contiguous prefix 1..totalSteps) so a stale step 5–7
    // completion lingering after a theme downgrade can't push progress > 100%.
    const totalSteps = applicableStepCount(isThemeSupported);
    const completedStep = completedSteps.filter(
        (step) => step <= totalSteps
    ).length;
    const progress = (completedStep / totalSteps) * 100;

    useEffect(() => {
        if (!hasMissedCriticalSteps && redirectToApp) {
            // Small delay to ensure the progress bar is updated
            setTimeout(() => {
                navigate("/app");
            }, 1000);
        }
    }, [hasMissedCriticalSteps, navigate, redirectToApp]);

    return (
        <s-stack gap="small">
            <s-text>
                <strong>{t("stepper.description")}</strong>
            </s-text>

            <s-stack direction="inline" gap="small" alignItems="center">
                <span style={{ whiteSpace: "nowrap" }}>
                    <s-text color="subdued">
                        {t("stepper.completedStep", {
                            completedStep,
                            totalSteps,
                        })}
                    </s-text>
                </span>
                <div style={{ maxWidth: "275px", width: "100%" }}>
                    <ProgressBar progress={progress} size="medium" />
                </div>
            </s-stack>
        </s-stack>
    );
}

function Steps({
    onboardingData,
    isThemeSupported,
}: {
    onboardingData: OnboardingStepData;
    isThemeSupported: boolean;
}) {
    return (
        <s-box paddingInlineStart="base">
            <s-stack gap="small-100">
                <Step1 onboardingData={onboardingData} />
                <Step2 onboardingData={onboardingData} />
                <Step3 onboardingData={onboardingData} />
                <Step4 onboardingData={onboardingData} />
                {/* Steps 5–7 need theme app blocks — N/A on legacy themes. */}
                {isThemeSupported && (
                    <>
                        <Step5 onboardingData={onboardingData} />
                        <Step6 onboardingData={onboardingData} />
                        <Step7 onboardingData={onboardingData} />
                    </>
                )}
            </s-stack>
        </s-box>
    );
}

type StepItemProps = {
    checked: boolean;
    stepNumber: number;
    children: ReactNode;
    currentStep: number;
};

export function StepItem({
    checked,
    stepNumber,
    children,
    currentStep,
}: StepItemProps) {
    return (
        <s-stack direction="inline" gap="small" alignItems="center">
            <div>
                {checked ? (
                    <s-icon type="check" />
                ) : currentStep === stepNumber ? (
                    <UncheckedIcon />
                ) : (
                    <s-icon type="disabled" color="subdued" />
                )}
            </div>
            <s-stack direction="inline" gap="small" alignItems="center">
                <div>
                    <s-text color="subdued">{stepNumber}.</s-text>
                </div>
                {children}
            </s-stack>
        </s-stack>
    );
}

function StepsFooter() {
    return (
        <div>
            <s-text color="subdued">
                <Trans
                    i18nKey="stepper.footer"
                    components={{
                        a: (
                            <a
                                href="mailto:hello@frak-labs.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="hello@frak-labs.com"
                            >
                                hello@frak-labs.com
                            </a>
                        ),
                    }}
                />
            </s-text>
        </div>
    );
}
