import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon, CopyIcon } from "@frak-labs/design-system/icons";
import {
    APP_STORE_URL,
    authenticatedBackendApi,
    buildPlayStoreInstallUrl,
    CodeInput,
    ExternalLink,
    getSafeSession,
    LogoFrakWithName,
    merchantKey,
    PLAY_STORE_URL,
    trackEvent,
    useFormattedEstimatedReward,
} from "@frak-labs/wallet-shared";
import { mediaSrcSet } from "@frak-labs/wallet-shared/common/utils/mediaSrcSet";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
 * Parses the `frak-install-v1` proof from the URL fragment (`#p=...`).
 *
 * A fragment, not a search param, deliberately: never sent to the server,
 * never logged, never in a `Referer` header. `validateSearch` only covers
 * search params, so this is a separate read off `window.location.hash`.
 * Must never throw — any malformed/missing fragment degrades silently to
 * "no proof".
 */
export function parseInstallProofFragment(hash: string): string | undefined {
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!raw) return undefined;
    try {
        return new URLSearchParams(raw).get("p") ?? undefined;
    } catch {
        return undefined;
    }
}

/**
 * Install page — unified entry point for the install/ensure flow.
 *
 * Decision matrix:
 *   Web + not logged in  → Install code + store links (user needs to download the app)
 *   Everything else      → Processing screen (fire ensure or store for post-auth)
 */
function InstallPage() {
    const search = Route.useSearch();
    // frak-install-v1 proof, read once from the fragment (not a search
    // param, never sent to the server). Forwarded to both InstallCodeView
    // and InstallProcessing — whether a proof is present is a property of
    // the input, not of which shell (web/Tauri) is running.
    const proof = useMemo(
        () => parseInstallProofFragment(window.location.hash),
        []
    );

    // Web + not logged in → show install code + store download links
    // Otherwise → use the web processing flow (ensure + register/login)
    const shouldShowCodeView = !IS_TAURI && !getSafeSession()?.token;

    useEffect(() => {
        trackEvent("install_page_viewed", {
            merchant_id: search.m,
            has_anonymous_id: Boolean(search.a),
            // Whether the `#p=` fragment survived the redirect chain;
            // purely diagnostic, attribution is preserved either way.
            has_install_proof: Boolean(proof),
            view: shouldShowCodeView ? "code" : "processing",
        });
    }, [search.m, search.a, proof, shouldShowCodeView]);

    if (shouldShowCodeView) {
        return <InstallCodeView {...search} proof={proof} />;
    }

    // Tauri (any auth) or web + logged in → processing
    return <InstallProcessing {...search} proof={proof} />;
}

// ---------------------------------------------------------------------------
//  Processing screen — shown on Tauri or when already logged in on web
// ---------------------------------------------------------------------------

const MIN_PROCESSING_MS = 500;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds the ensure action for the direct-link / Tauri processing path.
 * Exported for direct testing, mirroring `parseInstallProofFragment`.
 *
 * With merchantId/anonymousId but no proof, this is byte-identical to the
 * pre-existing bare action — a missing fragment degrades silently, never
 * blocks.
 */
export function buildInstallProcessingEnsureAction(params: {
    merchantId?: string;
    anonymousId?: string;
    proof?: string;
}):
    | {
          type: "ensure";
          merchantId: string;
          anonymousId: string;
          proof?: string;
      }
    | undefined {
    const { merchantId, anonymousId, proof } = params;
    if (!merchantId || !anonymousId) return undefined;
    return {
        type: "ensure",
        merchantId,
        anonymousId,
        ...(proof && { proof }),
    };
}

/**
 * Brief processing screen that handles the ensure call.
 *
 *   Logged in     → store ensure action + drain all pending actions + navigate /wallet
 *   Not logged in → store ensure action for post-auth + navigate /register
 *
 * Always shows for at least MIN_PROCESSING_MS to avoid a flash.
 */
function InstallProcessing({
    m: merchantId,
    a: anonymousId,
    proof,
}: InstallSearch & { proof?: string }) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { executePendingActions } = useExecutePendingActions();

    useEffect(() => {
        const ensureAction = buildInstallProcessingEnsureAction({
            merchantId,
            anonymousId,
            proof,
        });

        const isLoggedIn = !!getSafeSession()?.token;
        trackEvent("install_processing_triggered", {
            is_logged_in: isLoggedIn,
            has_ensure_action: Boolean(ensureAction),
            has_install_proof: Boolean(proof),
        });

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
    }, [merchantId, anonymousId, proof, navigate, executePendingActions]);

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

function merchantInfoQueryOptions(merchantId?: string) {
    return queryOptions({
        queryKey: merchantKey.info(merchantId),
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

function InstallCodeView({
    m: merchantId,
    a: anonymousId,
    proof,
}: InstallSearch & { proof?: string }) {
    const { t: rawT } = useTranslation();
    const [copied, setCopied] = useState(false);

    const { data: merchantInfo } = useQuery(
        merchantInfoQueryOptions(merchantId)
    );

    const { data: reward } = useFormattedEstimatedReward({
        merchantId,
    });
    const estimatedReward = reward?.formatted;

    // Wrap t to inject estimatedReward into i18n interpolation
    const t = useCallback(
        (key: string, options?: Record<string, unknown>) =>
            rawT(key, { ...options, estimatedReward: estimatedReward ?? "" }),
        [rawT, estimatedReward]
    );

    const {
        data,
        isLoading,
        error,
        status: codeQueryStatus,
    } = useGenerateInstallCode({
        merchantId,
        anonymousId,
        proof,
    });

    // `install_code_displayed` fires once per successful generation,
    // `install_code_generation_failed` fires on transition into error state.
    const reportedCodeRef = useRef<string | null>(null);
    const reportedErrorRef = useRef(false);
    useEffect(() => {
        if (data?.code && reportedCodeRef.current !== data.code) {
            reportedCodeRef.current = data.code;
            trackEvent("install_code_displayed", { merchant_id: merchantId });
        }
    }, [data?.code, merchantId]);
    useEffect(() => {
        if (codeQueryStatus === "error" && !reportedErrorRef.current) {
            reportedErrorRef.current = true;
            trackEvent("install_code_generation_failed", {
                merchant_id: merchantId,
                error_type: error instanceof Error ? error.name : "unknown",
            });
        } else if (codeQueryStatus !== "error") {
            reportedErrorRef.current = false;
        }
    }, [codeQueryStatus, error, merchantId]);

    const isAndroid = useMemo(() => /android/i.test(navigator.userAgent), []);
    const downloadUrl = useMemo(() => {
        if (!isAndroid) return APP_STORE_URL;
        if (!merchantId || !anonymousId) return PLAY_STORE_URL;
        return buildPlayStoreInstallUrl({
            merchantId,
            anonymousId,
            installProof: proof,
        });
    }, [merchantId, anonymousId, proof, isAndroid]);

    const handleCopy = useCallback(async () => {
        if (!data?.code) return;
        await navigator.clipboard.writeText(data.code);
        trackEvent("install_code_copied", { merchant_id: merchantId });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [data?.code, merchantId]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Box display="flex" alignItems="center" gap="m">
                    {merchantInfo?.logoUrl && (
                        <img
                            {...mediaSrcSet(merchantInfo.logoUrl)}
                            alt={merchantInfo.name}
                            className={styles.merchantLogo}
                        />
                    )}
                    <LogoFrakWithName className={styles.logo} />
                </Box>
                <button
                    type="button"
                    className={styles.dismissButton}
                    onClick={() => {
                        trackEvent("install_page_dismissed");
                        window.close();
                    }}
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
                            <CopyIcon width={16} height={16} />
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
                <ExternalLink
                    href={downloadUrl}
                    className={styles.downloadButton}
                    onClick={() => {
                        trackEvent("install_store_clicked", {
                            store: isAndroid ? "play_store" : "app_store",
                            has_referrer:
                                isAndroid && Boolean(merchantId && anonymousId),
                            has_referrer_proof: isAndroid && Boolean(proof),
                            merchant_id: merchantId,
                        });
                    }}
                >
                    {t("installCode.download")}
                </ExternalLink>
            </footer>
        </div>
    );
}
