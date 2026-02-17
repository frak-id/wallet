import { useWalletStatus } from "@frak-labs/react-sdk";
import { useMutation } from "@tanstack/react-query";
import { useRefreshData } from "app/hooks/useRefreshData";
import type { loader as rootLoader } from "app/routes/app";
import {
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher, useRouteLoaderData } from "react-router";
import { CollapsibleStep } from "./CollapsibleStep";

let pollTimeout: ReturnType<typeof setTimeout> | null = null;

export function Step1({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { merchantId } = onboardingData;
    const { t } = useTranslation();
    const refresh = useRefreshData();
    const { data: walletStatus } = useWalletStatus();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const fetcher = useFetcher();
    const { failedSteps } = validateCompleteOnboarding(onboardingData);

    // Check if the shop is connected
    const isConnected = !!merchantId;
    const isConnectedRef = useRef(isConnected);

    useEffect(() => {
        if (!isConnected) return;
        isConnectedRef.current = isConnected;
    }, [isConnected]);

    // Poll every 1s until merchantId is defined, then stop polling
    const pollForMerchantId = async () => {
        await refresh();

        if (!isConnectedRef.current) {
            pollTimeout = setTimeout(() => pollForMerchantId(), 1000);
            return;
        }

        if (pollTimeout) {
            clearTimeout(pollTimeout);
            pollTimeout = null;
        }
    };

    const { mutate: openMintEmbed, isPending } = useMutation({
        mutationKey: ["setup", "mint-embed"],
        mutationFn: async () => {
            if (!walletStatus?.wallet) return null;

            const url = `/api/mint?walletAddress=${encodeURIComponent(walletStatus.wallet)}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw {
                    error: `HTTP error ${response.status}`,
                    details: await response.text(),
                };
            }

            const setupCode: string = await response.json();

            // Build the url
            const mintUrl = new URL(
                process.env.BUSINESS_URL ?? "https://business.frak.id"
            );
            mintUrl.pathname = "/embedded/mint";
            mintUrl.searchParams.append("sc", setupCode);
            mintUrl.searchParams.append("d", rootData?.shop?.domain ?? "");
            mintUrl.searchParams.append("n", rootData?.shop?.name ?? "");
            mintUrl.searchParams.append("pt", "webshop,referral,purchase");

            const link = mintUrl.toString();

            const openedWindow = window.open(
                link,
                "frak-business",
                "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800"
            );

            if (openedWindow) {
                openedWindow.focus();

                // Check every 500ms if the window is closed
                // If it is, clear cache and revalidate the page
                const timer = setInterval(() => {
                    if (openedWindow.closed) {
                        clearInterval(timer);

                        // Clear the on-chain shop cache before revalidating
                        fetcher.submit(
                            { intent: "clearCache" },
                            { method: "POST", action: "/app/onboarding" }
                        );

                        pollForMerchantId();
                    }
                }, 500);
            }
        },
    });

    return (
        <CollapsibleStep
            step={1}
            currentStep={failedSteps[0]}
            completed={isConnected}
            title={t("status.connectionStatus.title")}
        >
            <s-text>{t("stepper.step1.description")}</s-text>
            <s-button
                onClick={() => openMintEmbed()}
                variant="primary"
                loading={isPending}
                disabled={walletStatus?.wallet === undefined}
            >
                {t("status.modal.button")}
            </s-button>
        </CollapsibleStep>
    );
}
