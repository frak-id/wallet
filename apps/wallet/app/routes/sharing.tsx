import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import type { EstimatedReward, SharingPageProduct } from "@frak-labs/core-sdk";
import {
    FrakContextManager,
    formatAmount,
    getCurrencyAmountKey,
    getSupportedCurrency,
} from "@frak-labs/core-sdk";
import {
    authenticatedBackendApi,
    clearConfirmation,
    clientIdStore,
    getSavedConfirmation,
    SharingPage,
    saveConfirmation,
    trackGenericEvent,
    useCopyToClipboardWithState,
    useShareLink,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type SharingSearch = {
    merchantId?: string;
    clientId?: string;
    link?: string;
    appName?: string;
    logoUrl?: string;
    products?: SharingPageProduct[];
    /** Shopify checkout token — fallback to resolve clientId when the `_frak-client-id` cart attribute is missing */
    checkoutToken?: string;
    /** Redirect URL for post-dismiss navigation (e.g. Shopify storefront) */
    redirectUrl?: string;
};

export const Route = createFileRoute("/sharing")({
    validateSearch: (search: Record<string, unknown>): SharingSearch => ({
        merchantId:
            typeof search.merchantId === "string"
                ? search.merchantId
                : undefined,
        clientId:
            typeof search.clientId === "string" ? search.clientId : undefined,
        link: typeof search.link === "string" ? search.link : undefined,
        appName:
            typeof search.appName === "string" ? search.appName : undefined,
        logoUrl:
            typeof search.logoUrl === "string" ? search.logoUrl : undefined,
        products:
            typeof search.products === "object"
                ? (search.products as SharingPageProduct[])
                : undefined,
        checkoutToken:
            typeof search.checkoutToken === "string"
                ? search.checkoutToken
                : undefined,
        redirectUrl:
            typeof search.redirectUrl === "string"
                ? search.redirectUrl
                : undefined,
    }),
    component: WalletSharingPage,
});

function WalletSharingPage() {
    const {
        merchantId,
        clientId: paramClientId,
        link,
        appName,
        logoUrl,
        products,
        checkoutToken,
        redirectUrl,
    } = Route.useSearch();
    const { t: rawT } = useTranslation();
    const navigate = useNavigate();
    const storeClientId = clientIdStore((s) => s.clientId);
    const { copy } = useCopyToClipboardWithState();

    // Fetch and format the best estimated reward for this merchant
    const { data: estimatedReward } = useQuery({
        queryKey: ["estimated-rewards", merchantId],
        queryFn: async () => {
            if (!merchantId) return undefined;
            const { data, error } =
                await authenticatedBackendApi.user.merchant[
                    "estimated-rewards"
                ].get({ query: { merchantId } });
            if (error || !data?.rewards?.length) return undefined;

            const currency = getSupportedCurrency();
            const amountKey = getCurrencyAmountKey(currency);

            const candidates = data.rewards
                .map((r) => r.referrer as EstimatedReward | undefined)
                .filter((r): r is EstimatedReward => r !== undefined);
            if (candidates.length === 0) return undefined;

            const best = candidates.reduce((acc, cur) => {
                const aVal = rewardSortValue(acc, amountKey);
                const cVal = rewardSortValue(cur, amountKey);
                return cVal > aVal ? cur : acc;
            });

            return formatEstimatedReward(best, currency, amountKey);
        },
        enabled: !!merchantId,
        staleTime: 5 * 60 * 1000,
    });

    // Wrap t to inject estimatedReward + productName into i18n interpolation
    const t = useCallback(
        (key: string, options?: Record<string, unknown>) =>
            rawT(key, {
                ...options,
                estimatedReward: estimatedReward ?? "",
                productName: appName ?? "",
            }),
        [rawT, estimatedReward, appName]
    );

    // Immediate clientId from params or store
    const immediateClientId = paramClientId ?? storeClientId;

    // Fallback: resolve clientId from the backend via checkout token when not directly provided
    const { data: resolvedClientId } = useQuery({
        queryKey: ["order-client", merchantId, checkoutToken],
        queryFn: async () => {
            if (!merchantId || !checkoutToken) return null;
            const { data, error } = await authenticatedBackendApi.user.identity[
                "order-client"
            ].get({
                query: {
                    merchantId,
                    checkoutToken,
                },
            });
            if (error) throw error;
            return data.clientId;
        },
        enabled: !immediateClientId && !!merchantId && !!checkoutToken,
        retry: 5,
        retryDelay: 300,
    });

    const clientId = immediateClientId ?? resolvedClientId ?? undefined;

    // Compute the install URL pointing to the /install route
    const installUrl = useMemo(() => {
        if (!(merchantId && clientId)) return null;
        return `/install?m=${encodeURIComponent(merchantId)}&a=${encodeURIComponent(clientId)}`;
    }, [merchantId, clientId]);

    // Check sessionStorage for a recent confirmation
    const [showConfirmation, setShowConfirmation] = useState(() =>
        merchantId ? getSavedConfirmation(merchantId) : false
    );

    // Build the final sharing link with Frak context
    const finalSharingLink = useMemo(() => {
        if (!(clientId && merchantId && link)) return null;
        return FrakContextManager.update({
            url: link,
            context: {
                v: 2,
                c: clientId,
                m: merchantId,
                t: Math.floor(Date.now() / 1000),
            },
        });
    }, [clientId, merchantId, link]);

    // Share mutation using the shared hook
    const {
        mutate: triggerSharing,
        isPending: isSharing,
        canShare,
    } = useShareLink(
        finalSharingLink,
        {
            title: t("sharing.title"),
            text: t("sharing.text"),
        },
        {
            onSuccess: (result) => {
                if (!result) return;
                toast.success(t("sharing.btn.shareSuccess"));
                trackGenericEvent("sharing-share-link", {
                    link: finalSharingLink,
                });
                if (merchantId) saveConfirmation(merchantId);
                setShowConfirmation(true);
            },
        }
    );

    const handleShare = () => {
        if (!finalSharingLink) return;
        triggerSharing();
    };

    const handleCopy = () => {
        if (!finalSharingLink) return;
        copy(finalSharingLink);
        trackGenericEvent("sharing-copy-link", {
            link: finalSharingLink,
        });
        toast.success(t("sharing.btn.copySuccess"));
        if (merchantId) saveConfirmation(merchantId);
        setShowConfirmation(true);
    };

    const handleDismiss = async () => {
        if (redirectUrl) {
            if (isTauri()) {
                // In Tauri, open the redirect URL in the external browser
                // and navigate back to the wallet home.
                const { openUrl } = await import("@tauri-apps/plugin-opener");
                await openUrl(redirectUrl);
                navigate({ to: "/wallet" });
                return;
            }
            window.location.assign(redirectUrl);
            return;
        }
        // Navigate back or close — on wallet this just goes to the home page
        navigate({ to: "/wallet" });
    };

    const handleShareAgain = () => {
        clearConfirmation();
        setShowConfirmation(false);
    };

    const handleInstall = useCallback(() => {
        if (!installUrl) return;
        navigate({
            to: "/install",
            search: { m: merchantId, a: clientId ?? undefined },
        });
    }, [installUrl, merchantId, clientId, navigate]);

    return (
        <SharingPage
            appName={appName ?? ""}
            logoUrl={logoUrl}
            products={products ?? []}
            sharingLink={finalSharingLink}
            installUrl={installUrl}
            t={t}
            isSharing={isSharing}
            canShare={canShare}
            showConfirmation={showConfirmation}
            onShare={handleShare}
            onCopy={handleCopy}
            onDismiss={handleDismiss}
            onShareAgain={handleShareAgain}
            onInstall={handleInstall}
            onConfirmationDismiss={handleDismiss}
        />
    );
}

function rewardSortValue(
    reward: EstimatedReward,
    key: "amount" | "eurAmount" | "usdAmount" | "gbpAmount"
): number {
    switch (reward.payoutType) {
        case "fixed":
            return reward.amount[key];
        case "percentage":
            return reward.maxAmount?.[key] ?? 0;
        case "tiered":
            return reward.tiers.reduce(
                (max, tier) => Math.max(max, tier.amount[key]),
                0
            );
    }
}

function formatEstimatedReward(
    reward: EstimatedReward,
    currency: Parameters<typeof formatAmount>[1],
    amountKey: "amount" | "eurAmount" | "usdAmount" | "gbpAmount"
): string {
    switch (reward.payoutType) {
        case "fixed":
            return formatAmount(
                Math.round(reward.amount[amountKey]),
                currency
            );
        case "percentage":
            return `${reward.percent} %`;
        case "tiered": {
            const max = reward.tiers.reduce(
                (m, tier) => Math.max(m, tier.amount[amountKey]),
                0
            );
            return formatAmount(Math.round(max), currency);
        }
    }
}
