import { useWalletStatus } from "@frak-labs/react-sdk";
import { useQuery } from "@tanstack/react-query";
import { useRefreshData } from "app/hooks/useRefreshData";
import type { loader as rootLoader } from "app/routes/app";
import {
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher, useRouteLoaderData } from "react-router";
import { CollapsibleStep } from "./CollapsibleStep";

/**
 * Max number of refresh retries after popup close
 * before giving up on automatic merchant detection.
 */
const maxRefreshRetries = 10;

/**
 * Map shop preferred currency to its matching Frak stablecoin.
 * Defaults to EURe when the currency is unknown.
 */
const currencyToStablecoin = {
    usd: "usdc",
    eur: "eure",
    gbp: "gbpe",
} as const;

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

    const isConnected = !!merchantId;

    // Pre-fetch mint URL so it's available synchronously at click time
    // (avoids popup blocker — no async gap between click and window.open)
    const { data: mintUrl, isLoading: isMintUrlLoading } = useQuery({
        queryKey: [
            "setup",
            "mint-url",
            walletStatus?.wallet,
            rootData?.shop?.domain,
            rootData?.shop?.name,
            rootData?.shop?.preferredCurrency,
            rootData?.shop?.myshopifyDomain,
        ],
        queryFn: async () => {
            const wallet = walletStatus?.wallet;
            const domain = rootData?.shop?.domain;
            if (!wallet || !domain) return null;

            const url = `/api/mint?walletAddress=${encodeURIComponent(wallet)}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const setupCode: string = await response.json();

            const mintUrl = new URL(
                rootData?.businessUrl ?? "https://business.frak.id"
            );
            mintUrl.pathname = "/embedded/mint";
            mintUrl.searchParams.append("sc", setupCode);
            mintUrl.searchParams.append("d", domain);
            mintUrl.searchParams.append(
                "c",
                currencyToStablecoin[rootData?.shop?.preferredCurrency ?? "eur"]
            );
            if (rootData?.shop?.name) {
                mintUrl.searchParams.append("n", rootData.shop.name);
            }
            const myshopifyDomain = rootData?.shop?.myshopifyDomain;
            if (myshopifyDomain && myshopifyDomain !== domain) {
                mintUrl.searchParams.append("sd", myshopifyDomain);
            }

            return mintUrl.toString();
        },
        enabled: !!walletStatus?.wallet && !!rootData?.shop?.domain,
    });

    // Track opened popup and retry state
    const popupRef = useRef<Window | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [awaitingMerchant, setAwaitingMerchant] = useState(false);
    const retryCountRef = useRef(0);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
            }
        };
    }, []);

    // Stop retry polling once merchant is detected
    useEffect(() => {
        if (isConnected && awaitingMerchant) {
            setAwaitingMerchant(false);
            retryCountRef.current = 0;
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        }
    }, [isConnected]);

    // Trigger a single clearCache + refresh cycle
    const triggerRefresh = useCallback(() => {
        fetcher.submit(
            { intent: "clearCache" },
            { method: "POST", action: "/app/onboarding" }
        );
        refresh();
    }, [fetcher, refresh]);

    // Open mint page as popup and poll for close
    const handleClick = useCallback(() => {
        if (!mintUrl) return;

        // Clear any previous polling
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        setAwaitingMerchant(false);
        retryCountRef.current = 0;

        // Open popup synchronously — no async gap, no popup blocker
        const popup = window.open(
            mintUrl,
            "frak-business",
            "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500,height=800"
        );
        popupRef.current = popup;

        // Poll for popup close, then retry refresh until merchant found
        if (popup) {
            pollRef.current = setInterval(() => {
                if (!popup.closed) return;

                // Popup just closed — switch to merchant refresh polling
                setAwaitingMerchant(true);
                retryCountRef.current = 0;
                popupRef.current = null;

                // Clear popup-close poll, start merchant-refresh poll
                if (pollRef.current) {
                    clearInterval(pollRef.current);
                }
                triggerRefresh();
                pollRef.current = setInterval(() => {
                    retryCountRef.current++;
                    if (retryCountRef.current >= maxRefreshRetries) {
                        setAwaitingMerchant(false);
                        if (pollRef.current) {
                            clearInterval(pollRef.current);
                            pollRef.current = null;
                        }
                        return;
                    }
                    triggerRefresh();
                }, 2000);
            }, 500);
        }
    }, [mintUrl, triggerRefresh]);

    return (
        <CollapsibleStep
            step={1}
            currentStep={failedSteps[0]}
            completed={isConnected}
            title={t("status.connectionStatus.title")}
        >
            <s-text>{t("stepper.step1.description")}</s-text>
            <s-button
                onClick={handleClick}
                variant="primary"
                loading={isMintUrlLoading || awaitingMerchant}
                disabled={!mintUrl || awaitingMerchant}
            >
                {t("status.modal.button")}
            </s-button>
        </CollapsibleStep>
    );
}
