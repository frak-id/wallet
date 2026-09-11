import { useRefreshData } from "app/hooks/useRefreshData";
import {
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";
import { CollapsibleStep } from "./CollapsibleStep";

/**
 * Inline embedded merchant registration — one POST to `/api/register`, no
 * wallet, no popup, no polling.
 */
export function Step1({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { merchantId } = onboardingData;
    const { t } = useTranslation();
    const refresh = useRefreshData();
    const fetcher = useFetcher<{ merchantId?: string; error?: string }>();
    const { failedSteps } = validateCompleteOnboarding(onboardingData);

    const isConnected = !!merchantId;
    const isSubmitting = fetcher.state !== "idle";

    // Refresh loader data once, so the step flips to "connected".
    const hasRefreshedRef = useRef(false);
    useEffect(() => {
        if (fetcher.data?.merchantId && !hasRefreshedRef.current) {
            hasRefreshedRef.current = true;
            refresh();
        }
    }, [fetcher.data, refresh]);

    return (
        <CollapsibleStep
            step={1}
            currentStep={failedSteps[0]}
            completed={isConnected}
            title={t("status.connectionStatus.title")}
        >
            <s-text>{t("stepper.step1.description")}</s-text>
            <s-stack direction="inline" gap="small">
                <s-button
                    onClick={() =>
                        fetcher.submit(
                            {},
                            { method: "POST", action: "/api/register" }
                        )
                    }
                    variant="primary"
                    loading={isSubmitting}
                    disabled={isConnected || isSubmitting}
                >
                    {t("status.modal.button")}
                </s-button>
            </s-stack>
            {fetcher.data?.error && (
                <s-text tone="critical">{fetcher.data.error}</s-text>
            )}
        </CollapsibleStep>
    );
}
