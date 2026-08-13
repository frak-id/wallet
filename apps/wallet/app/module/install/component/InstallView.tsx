import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CloseIcon,
    CopyIcon,
    LogoFrakWithName,
} from "@frak-labs/design-system/icons";
import { trackEvent } from "@frak-labs/wallet-shared/common/analytics";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { CodeInput } from "@frak-labs/wallet-shared/common/component/CodeInput";
import { ExternalLink } from "@frak-labs/wallet-shared/common/component/ExternalLink";
import { useFormattedEstimatedReward } from "@frak-labs/wallet-shared/common/hook/useFormattedEstimatedReward";
import { merchantKey } from "@frak-labs/wallet-shared/common/queryKeys/merchant";
import { mediaSrcSet } from "@frak-labs/wallet-shared/common/utils/mediaSrcSet";
import { getSafeSession } from "@frak-labs/wallet-shared/common/utils/safeSession";
import {
    APP_STORE_URL,
    PLAY_STORE_URL,
} from "@frak-labs/wallet-shared/common/utils/storeUrls";
import { buildPlayStoreInstallUrl } from "@frak-labs/wallet-shared/sharing";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { isHostEmbedded } from "@/module/common/utils/hostEmbed";
import type { InstallSearch } from "@/module/install/params";
import {
    buildInstallProcessingEnsureAction,
    resolveInstallProof,
} from "@/module/install/params";
import { useInstallActivation } from "@/module/install/params/fragment";
import {
    fireEnsureActions,
    queuePendingAction,
} from "@/module/pending-actions/drainEnsures";
import { useGenerateInstallCode } from "@/module/recovery-code/hook/useGenerateInstallCode";
import { sendHostResult } from "@/module/sharing/host/bridge";
import * as styles from "./install.css";

/**
 * How this surface leaves the page once the install handoff is done. The SPA
 * route uses TanStack Router; the standalone `/install` entrypoint has no
 * router and does document navigations instead.
 */
export type InstallNavigation = {
    toWallet: () => void;
    toRegister: () => void;
};

/**
 * Install page: install code + store links for a logged-out web visitor,
 * processing screen otherwise.
 *
 * Rendered by both the wallet SPA route and the standalone `/install`
 * entrypoint; only the param source and the navigations differ.
 */
export function InstallView({
    search,
    navigation,
    /**
     * The processing screen's chrome. The standalone entrypoint has no
     * `PageLayout` (that component belongs to the wallet shell), so the shell
     * passes its own wrapper in.
     */
    processingLayout: ProcessingLayout,
}: {
    search: InstallSearch;
    navigation: InstallNavigation;
    processingLayout: React.ComponentType<{ children: React.ReactNode }>;
}) {
    const { m, a, p, embed, returnScheme, sid } = search;
    // Read once, and forwarded to both views whichever shell is running.
    const proof = useMemo(
        () => resolveInstallProof(window.location.hash, p),
        [p]
    );

    const shouldShowCodeView = !IS_TAURI && !getSafeSession()?.token;

    useEffect(() => {
        trackEvent("install_page_viewed", {
            merchant_id: m,
            has_anonymous_id: Boolean(a),
            has_install_proof: Boolean(proof),
            view: shouldShowCodeView ? "code" : "processing",
        });
    }, [m, a, proof, shouldShowCodeView]);

    if (shouldShowCodeView) {
        return (
            <InstallCodeView
                m={m}
                a={a}
                proof={proof}
                embed={embed}
                returnScheme={returnScheme}
                sid={sid}
            />
        );
    }

    // Tauri (any auth) or web + logged in → processing
    return (
        <InstallProcessing
            m={m}
            a={a}
            proof={proof}
            navigation={navigation}
            layout={ProcessingLayout}
        />
    );
}

// ---------------------------------------------------------------------------
//  Processing screen — shown on Tauri or when already logged in on web
// ---------------------------------------------------------------------------

const MIN_PROCESSING_MS = 500;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Brief processing screen around the ensure call, then on to `/wallet` or
 * `/register`. Always shown for at least MIN_PROCESSING_MS to avoid a flash.
 */
function InstallProcessing({
    m: merchantId,
    a: anonymousId,
    proof,
    navigation,
    layout: Layout,
}: InstallSearch & {
    proof?: string;
    navigation: InstallNavigation;
    layout: React.ComponentType<{ children: React.ReactNode }>;
}) {
    const { t } = useTranslation();

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
            // Ensures are fire-and-forget and navigation is never delegated
            // here, so the router-free half of the drain is all this needs.
            fireEnsureActions(queuePendingAction(ensureAction), ensureAction);
            sleep(MIN_PROCESSING_MS).then(() => navigation.toWallet());
        } else {
            if (ensureAction) queuePendingAction(ensureAction);
            sleep(MIN_PROCESSING_MS).then(() => navigation.toRegister());
        }
    }, [merchantId, anonymousId, proof, navigation]);

    return (
        <Layout>
            <Stack space={"l"} align={"center"}>
                <Spinner />
                <Text variant="bodySmall" color="secondary">
                    {t("installCode.processing")}
                </Text>
            </Stack>
        </Layout>
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
    embed,
    returnScheme,
    sid,
}: InstallSearch & { proof?: string }) {
    const { t: rawT } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [showCodeAfterInstall, setShowCodeAfterInstall] = useState(false);

    const { data: merchantInfo } = useQuery(
        merchantInfoQueryOptions(merchantId)
    );

    const { data: reward } = useFormattedEstimatedReward({
        merchantId,
    });
    const estimatedReward = reward?.formatted;

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

    const activation = useInstallActivation(true);
    const installed = activation?.installed === "1";

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

    // `probe` arrives on the very first load (no host round trip needed), so
    // unavailability is reported once on mount rather than waiting on a
    // `hashchange` that a disabled/undeclared probe will never send.
    const reportedProbeRef = useRef(false);
    useEffect(() => {
        const probe = activation?.probe;
        if (!probe || probe === "ok" || reportedProbeRef.current) return;
        reportedProbeRef.current = true;
        trackEvent("install_probe_unavailable", {
            merchant_id: merchantId,
            reason: probe,
        });
    }, [activation?.probe, merchantId]);

    const reportedDetectionRef = useRef(false);
    useEffect(() => {
        if (!installed || reportedDetectionRef.current) return;
        reportedDetectionRef.current = true;
        trackEvent("install_detected", {
            merchant_id: merchantId,
            elapsed_ms: activation?.dt ?? 0,
            surface: activation?.via ?? "product",
        });
    }, [installed, activation?.dt, activation?.via, merchantId]);

    /**
     * Hands the code to the native host, which can give the pasteboard entry an
     * expiry and `localOnly`; this page cannot. No-op without a `returnScheme`.
     * From a user gesture only: `assign()` to a custom scheme raises the OS
     * "open in app?" sheet, whose blur/refocus would retrigger an effect.
     */
    const handOverCode = useCallback(() => {
        if (!data?.code) return;
        const expiresAt = new Date(data.expiresAt).getTime();
        sendHostResult({
            scheme: returnScheme,
            action: "code",
            sid,
            value: data.code,
            expiresAt: Number.isFinite(expiresAt)
                ? Math.floor(expiresAt / 1000)
                : undefined,
        });
    }, [data?.code, data?.expiresAt, returnScheme, sid]);

    // A native host already draws a title, a drag handle and a scrim, and this
    // page's own close button calls `window.close()`, which a web view ignores.
    // Reads `embed`, not `returnScheme`; spoofable, but it only hides the header.
    const chromeless = isHostEmbedded(embed);

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
        // Where there is a host, its write supersedes this one: same code, but
        // marked sensitive and given an expiry.
        handOverCode();
        trackEvent("install_code_copied", { merchant_id: merchantId });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [data?.code, merchantId, handOverCode]);

    return (
        <div
            className={
                chromeless
                    ? `${styles.container} ${styles.containerChromeless}`
                    : styles.container
            }
        >
            {!chromeless && (
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
            )}

            <main className={styles.main}>
                <section className={styles.heroSection}>
                    {installed ? (
                        <>
                            <Badge
                                variant="success"
                                className={styles.installedBadge}
                            >
                                {t("installCode.installedTitle")}
                            </Badge>
                            <Text
                                as="h1"
                                variant="heading2"
                                className={styles.title}
                            >
                                {t("installCode.installedHeadline")}
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text
                                as="h1"
                                variant="heading2"
                                className={styles.title}
                            >
                                {t("installCode.title")}
                            </Text>
                            <Text variant="bodySmall" color="secondary">
                                {t("installCode.description")}
                            </Text>
                        </>
                    )}
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

                {data?.code && installed && !showCodeAfterInstall && (
                    <button
                        type="button"
                        className={styles.installedCodeToggle}
                        onClick={() => setShowCodeAfterInstall(true)}
                    >
                        {t("installCode.installedCodeToggle")}
                    </button>
                )}

                {data?.code && (!installed || showCodeAfterInstall) && (
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
                        if (installed) {
                            trackEvent("install_open_wallet_clicked", {
                                merchant_id: merchantId,
                            });
                            return;
                        }
                        // Last gesture before leaving for the store, so the code is
                        // on the pasteboard even if they never tapped copy.
                        handOverCode();
                        trackEvent("install_store_clicked", {
                            store: isAndroid ? "play_store" : "app_store",
                            has_referrer:
                                isAndroid && Boolean(merchantId && anonymousId),
                            has_referrer_proof: isAndroid && Boolean(proof),
                            merchant_id: merchantId,
                        });
                    }}
                >
                    {installed
                        ? t("installCode.openWallet")
                        : t("installCode.download")}
                </ExternalLink>
            </footer>
        </div>
    );
}
