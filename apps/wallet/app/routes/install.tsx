import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon, CopyIcon } from "@frak-labs/design-system/icons";
import {
    authenticatedBackendApi,
    CodeInput,
    getSafeSession,
    LogoFrakWithName,
    useFormattedEstimatedReward,
} from "@frak-labs/wallet-shared";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { useExecutePendingActions } from "@/module/pending-actions/hook/useExecutePendingActions";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { useGenerateInstallCode } from "@/module/recovery-code/hook/useGenerateInstallCode";
import * as styles from "./install.css";

type InstallSearch = {
    m?: string;
    a?: string;
};

export const Route = createFileRoute("/install")({
    validateSearch: (search: Record<string, unknown>): InstallSearch => ({
        m: typeof search.m === "string" ? search.m : undefined,
        a: typeof search.a === "string" ? search.a : undefined,
    }),
    component: InstallPage,
});

/**
 * Install page — unified entry point for the install/ensure flow.
 *
 * Decision matrix:
 *   Web + not logged in  → Install code + store links (user needs to download the app)
 *   Everything else      → Processing screen (fire ensure or store for post-auth)
 */
function InstallPage() {
    const search = Route.useSearch();

    // Web + not logged in + app available → show install code + store download links
    // Otherwise → use the web processing flow (ensure + register/login)
    if (
        process.env.IS_APP_AVAILABLE === "true" &&
        !isTauri() &&
        !getSafeSession()?.token
    ) {
        return <InstallCodeView {...search} />;
    }

    // Tauri (any auth) or web + logged in → processing
    return <InstallProcessing {...search} />;
}

// ---------------------------------------------------------------------------
//  Processing screen — shown on Tauri or when already logged in on web
// ---------------------------------------------------------------------------

const MIN_PROCESSING_MS = 500;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Brief processing screen that handles the ensure call.
 *
 *   Logged in     → store ensure action + drain all pending actions + navigate /wallet
 *   Not logged in → store ensure action for post-auth + navigate /register
 *
 * Always shows for at least MIN_PROCESSING_MS to avoid a flash.
 */
function InstallProcessing({ m: merchantId, a: anonymousId }: InstallSearch) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { executePendingActions } = useExecutePendingActions();

    useEffect(() => {
        // Build ensure action from install referral params
        const ensureAction =
            merchantId && anonymousId
                ? ({
                      type: "ensure",
                      merchantId,
                      anonymousId,
                  } as const)
                : undefined;

        const isLoggedIn = !!getSafeSession()?.token;

        if (isLoggedIn) {
            Promise.all([
                executePendingActions({
                    newAction: ensureAction,
                    skipNavigation: true,
                }),
                sleep(MIN_PROCESSING_MS),
            ]).then(() => {
                navigate({ to: "/wallet", replace: true });
            });
        } else {
            // Not logged in — store for post-auth, redirect to register
            if (ensureAction) {
                pendingActionsStore.getState().addAction(ensureAction);
            }
            sleep(MIN_PROCESSING_MS).then(() => {
                navigate({ to: "/register", replace: true });
            });
        }
    }, [merchantId, anonymousId, navigate, executePendingActions]);

    return (
        <PageLayout>
            <Stack space={"l"} align={"center"}>
                <Spinner />
                <Text variant="bodySmall" color="secondary">
                    {t("installCode.processing")}
                </Text>
            </Stack>
        </PageLayout>
    );
}

// ---------------------------------------------------------------------------
//  Install code view — web only, when the user needs to download the app
// ---------------------------------------------------------------------------

const appStoreUrl = "https://apps.apple.com/app/frak-wallet/id6740261164";
const playStoreUrl =
    "https://play.google.com/store/apps/details?id=id.frak.wallet";

function merchantInfoQueryOptions(merchantId?: string) {
    return queryOptions({
        queryKey: ["merchant", "info", merchantId ?? "none"],
        queryFn: async () => {
            if (!merchantId) return null;
            const { data } =
                await authenticatedBackendApi.user.merchant.resolve.get({
                    query: { merchantId },
                });
            if (!data) return null;
            return {
                name: data.name,
                logoUrl: data.sdkConfig?.logoUrl,
            };
        },
        enabled: !!merchantId,
        staleTime: 5 * 60 * 1000,
    });
}

function InstallCodeView({ m: merchantId, a: anonymousId }: InstallSearch) {
    const { t: rawT } = useTranslation();
    const [copied, setCopied] = useState(false);

    const { data: merchantInfo } = useQuery(
        merchantInfoQueryOptions(merchantId)
    );

    const { data: estimatedReward } = useFormattedEstimatedReward({
        merchantId,
    });

    // Wrap t to inject estimatedReward into i18n interpolation
    const t = useCallback(
        (key: string, options?: Record<string, unknown>) =>
            rawT(key, { ...options, estimatedReward: estimatedReward ?? "" }),
        [rawT, estimatedReward]
    );

    const { data, isLoading, error } = useGenerateInstallCode({
        merchantId,
        anonymousId,
    });

    // Platform-aware store URL
    const downloadUrl = useMemo(() => {
        const isAndroid = /android/i.test(navigator.userAgent);
        if (!isAndroid) return appStoreUrl;
        if (!merchantId || !anonymousId) return playStoreUrl;
        const referrerData = `merchantId=${merchantId}&anonymousId=${anonymousId}`;
        return `${playStoreUrl}&referrer=${encodeURIComponent(referrerData)}`;
    }, [merchantId, anonymousId]);

    const handleCopy = useCallback(async () => {
        if (!data?.code) return;
        await navigator.clipboard.writeText(data.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [data?.code]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Box display="flex" alignItems="center" gap="m">
                    {merchantInfo?.logoUrl && (
                        <img
                            src={merchantInfo.logoUrl}
                            alt={merchantInfo.name}
                            className={styles.merchantLogo}
                        />
                    )}
                    <LogoFrakWithName className={styles.logo} color="#000" />
                </Box>
                <button
                    type="button"
                    className={styles.dismissButton}
                    onClick={() => window.close()}
                >
                    <CloseIcon width={24} height={24} />
                </button>
            </header>

            <main className={styles.main}>
                <section className={styles.heroSection}>
                    <Text as="h1" variant="heading2" className={styles.title}>
                        {t("installCode.title")}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("installCode.description")}
                    </Text>
                </section>

                {isLoading && (
                    <Stack space="m" align="center">
                        <Spinner />
                        <Text variant="bodySmall" color="secondary">
                            {t("installCode.loading")}
                        </Text>
                    </Stack>
                )}

                {error && (
                    <Text variant="bodySmall" color="error" align="center">
                        {t("installCode.error")}
                    </Text>
                )}

                {data?.code && (
                    <Stack space="m" align="center">
                        <CodeInput value={data.code} mode="alphanumeric" />
                        <Button
                            size="large"
                            fontSize="s"
                            width="full"
                            className={styles.copyButton}
                            onClick={handleCopy}
                        >
                            {copied
                                ? t("installCode.codeCopied")
                                : t("installCode.copyCode")}
                            <CopyIcon />
                        </Button>
                    </Stack>
                )}
            </main>

            <Card
                variant="secondary"
                padding="compact"
                className={styles.infoCard}
            >
                <Inline space="s" alignY="top" wrap={false}>
                    <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                    <Stack space="xxs">
                        <Text variant="heading4" weight="medium">
                            {t("installCode.infoTitle")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            <Trans
                                i18nKey="installCode.infoDescription"
                                components={{
                                    1: (
                                        <Text
                                            as="span"
                                            variant="bodySmall"
                                            weight="medium"
                                            color="action"
                                        />
                                    ),
                                }}
                            />
                        </Text>
                    </Stack>
                </Inline>
            </Card>

            <footer className={styles.footer}>
                <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.downloadButton}
                >
                    {t("installCode.download")}
                </a>
            </footer>
        </div>
    );
}
