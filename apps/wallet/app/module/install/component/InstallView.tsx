import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CircleCheckIcon,
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
import type { Translate } from "@frak-labs/wallet-shared/types";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
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
    const { m, a, checkoutToken, p, embed, returnScheme, sid } = search;
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
            has_checkout_token: Boolean(checkoutToken),
            has_install_proof: Boolean(proof),
            view: shouldShowCodeView ? "code" : "processing",
        });
    }, [m, a, checkoutToken, proof, shouldShowCodeView]);

    if (shouldShowCodeView) {
        return (
            <InstallCodeView
                m={m}
                a={a}
                checkoutToken={checkoutToken}
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
            checkoutToken={checkoutToken}
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

/**
 * Ceiling on anything the confirmation merely *decorates* itself with. An
 * offline react-query fetch is paused, not rejected, so it settles neither
 * way; only a bound keeps the exit reachable.
 */
const MERCHANT_LOOKUP_TIMEOUT_MS = 1500;

/**
 * How long the confirmation waits before leaving on the user's behalf. It is
 * the only exit from this page, and `ResponsiveModal` draws no close button,
 * so an idle user would otherwise sit there. Long enough to read the merchant
 * name and tap the CTA first.
 */
const CONFIRMATION_IDLE_EXIT_MS = 10_000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolves `null` rather than hanging when `work` outlives `ms`. */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([work, sleep(ms).then(() => null)]);
}

/**
 * Lightweight merchant lookup, shared by both branches: the processing screen
 * names the merchant in its confirmation, the code screen draws its logo.
 */
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

/**
 * Brief processing screen around the ensure call. A logged-in Tauri visitor
 * carrying a merchant id ends on a confirmation and leaves when it is
 * dismissed; every other arm auto-exits after MIN_PROCESSING_MS.
 */
function InstallProcessing({
    m: merchantId,
    a: anonymousId,
    checkoutToken,
    proof,
    navigation,
    layout: Layout,
}: InstallSearch & {
    proof?: string;
    navigation: InstallNavigation;
    layout: React.ComponentType<{ children: React.ReactNode }>;
}) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    // The confirmation sits over this screen, so a spinner still claiming
    // "setting up" contradicts it. Flips once the handoff is done.
    const [settled, setSettled] = useState(false);

    // `ModalOutlet` lives in the SPA root only, so the standalone entrypoint
    // has nowhere to render a confirmation. Gating on Tauri keeps that surface
    // — a logged-in web visitor also reaches this branch — on the auto-exit.
    const confirms = IS_TAURI && !!merchantId;

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
            // This branch cannot resolve a token to an id, so a Shopify buyer
            // who already has the wallet loses that attribution here.
            has_checkout_token: Boolean(checkoutToken),
            has_install_proof: Boolean(proof),
        });

        // Every arm below settles asynchronously; none may act once the
        // screen is gone.
        let cancelled = false;
        let idleExit: number | undefined;

        if (!isLoggedIn) {
            if (ensureAction) queuePendingAction(ensureAction);
            sleep(MIN_PROCESSING_MS).then(() => {
                if (!cancelled) navigation.toRegister();
            });
            return () => {
                cancelled = true;
            };
        }

        // Ensures are fire-and-forget and navigation is never delegated
        // here, so the router-free half of the drain is all this needs.
        fireEnsureActions(queuePendingAction(ensureAction), ensureAction);

        if (!confirms) {
            sleep(MIN_PROCESSING_MS).then(() => {
                if (!cancelled) navigation.toWallet();
            });
            return () => {
                cancelled = true;
            };
        }

        // The confirmation owns the exit from here; dismissing it is what
        // leaves the page. The merchant name is worth a bounded wait — a cold
        // cache resolves slower than the dwell — but nothing here may gate the
        // exit: an offline query is paused, so it neither resolves nor
        // rejects, and awaiting it unbounded strands the user on the spinner.
        Promise.all([
            sleep(MIN_PROCESSING_MS),
            withTimeout(
                queryClient
                    .ensureQueryData(merchantInfoQueryOptions(merchantId))
                    .catch(() => null),
                MERCHANT_LOOKUP_TIMEOUT_MS
            ),
            // Kept out of the standalone chunk, which has no `ModalOutlet`
            // and would otherwise pay for the store and its analytics
            // subscription.
            withTimeout(
                import("@/module/stores/modalStore").catch(() => null),
                MERCHANT_LOOKUP_TIMEOUT_MS
            ),
        ]).then(([, merchant, store]) => {
            if (cancelled) return;
            // No store means no confirmation is possible; leaving is the one
            // behaviour this screen must never fail to do.
            if (!store) {
                navigation.toWallet();
                return;
            }
            const name = merchant?.name;
            setSettled(true);
            const { modalStore } = store;
            modalStore.getState().openModal({
                id: "recoveryCodeSuccess",
                merchant: name ? { name } : undefined,
                onExit: () => navigation.toWallet(),
                actionLabel: t("installCode.openWalletCta"),
            });

            // Backstop: this modal is the only way off the page, so an idle
            // user must not be stranded. Long enough to read and act first —
            // dismissing early leaves nothing for this to close, and the
            // store fires `onExit` once whichever path wins.
            idleExit = window.setTimeout(() => {
                if (modalStore.getState().modal?.id === "recoveryCodeSuccess") {
                    modalStore.getState().closeModal();
                }
            }, CONFIRMATION_IDLE_EXIT_MS);
        });
        return () => {
            cancelled = true;
            if (idleExit) window.clearTimeout(idleExit);
        };
    }, [
        merchantId,
        anonymousId,
        checkoutToken,
        proof,
        navigation,
        confirms,
        queryClient,
    ]);

    return (
        <Layout>
            <Stack space={"l"} align={"center"}>
                {settled ? (
                    <IconCircle size="lg" tone="action">
                        <CircleCheckIcon width={28} height={28} />
                    </IconCircle>
                ) : (
                    <Spinner />
                )}
                <Text variant="bodySmall" color="secondary">
                    {t(
                        settled
                            ? "installCode.processingDone"
                            : "installCode.processing"
                    )}
                </Text>
            </Stack>
        </Layout>
    );
}

// ---------------------------------------------------------------------------
//  Install code view — web only, when the user needs to download the app
// ---------------------------------------------------------------------------

function InstallCodeHero({
    t,
    installed,
    codeless,
    merchantName,
}: {
    t: Translate;
    installed: boolean;
    codeless: boolean;
    merchantName?: string;
}) {
    if (installed) {
        return (
            <>
                <IconCircle
                    size="lg"
                    tone="action"
                    className={styles.installedIcon}
                >
                    <CircleCheckIcon width={28} height={28} />
                </IconCircle>
                <Text as="h1" variant="heading2" className={styles.title}>
                    {t("installCode.installedHeadline")}
                </Text>
                {merchantName && (
                    <Text variant="bodySmall" color="secondary">
                        {t("installCode.installedMerchant", { merchantName })}
                    </Text>
                )}
            </>
        );
    }

    return (
        <>
            <Text as="h1" variant="heading2" className={styles.title}>
                {t(
                    codeless ? "installCode.codelessTitle" : "installCode.title"
                )}
            </Text>
            <Text variant="bodySmall" color="secondary">
                {t(
                    codeless
                        ? "installCode.codelessDescription"
                        : "installCode.description"
                )}
            </Text>
        </>
    );
}

function InstallCodeInfoCard({ t }: { t: Translate }) {
    return (
        <Card variant="secondary" padding="compact" className={styles.infoCard}>
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
    );
}

function InstallCodeView({
    m: merchantId,
    a: anonymousId,
    checkoutToken,
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

    const t = useCallback<Translate>(
        (key, options) =>
            rawT(key, { ...options, estimatedReward: estimatedReward ?? "" }),
        [rawT, estimatedReward]
    );

    const {
        data,
        isLoading,
        error,
        status: codeQueryStatus,
        fetchStatus: codeFetchStatus,
    } = useGenerateInstallCode({
        merchantId,
        anonymousId,
        checkoutToken,
        proof,
    });

    // No credential to mint from, one the backend refused, a mint that failed
    // for good, or one paused offline — the last has no spinner either, since
    // `isLoading` needs `isFetching`. Either way the store link below is the
    // whole surface, so this must never render as an error, and never as a
    // "copy this code" hero with no code beneath it.
    const codeless =
        !(anonymousId || checkoutToken) ||
        codeQueryStatus === "error" ||
        codeFetchStatus === "paused" ||
        (codeQueryStatus === "success" && !data?.code);

    const activation = useInstallActivation(true);
    const installed = activation?.installed === "1";

    // The code on screen right now: none until it mints, and the installed
    // state keeps it collapsed behind the toggle.
    const visibleCode =
        installed && !showCodeAfterInstall ? undefined : data?.code;

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
                // `.name` is always "Error"; the message carries the status.
                error_type: error instanceof Error ? error.message : "unknown",
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
     * expiry and `localOnly`; this page cannot. Returns whether a host took it.
     * From a user gesture only: `assign()` to a custom scheme raises the OS
     * "open in app?" sheet, whose blur/refocus would retrigger an effect.
     */
    const handOverCode = useCallback(() => {
        if (!data?.code) return false;
        const expiresAt = new Date(data.expiresAt).getTime();
        return sendHostResult({
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

        // Isolated: `writeText` rejects on a denied permission, a non-secure
        // context or an unfocused document, and none of those should stop the
        // handoff below.
        const copied = await navigator.clipboard
            .writeText(data.code)
            .then(() => true)
            .catch(() => false);

        // After the local write, never before: a host writes the same code
        // marked sensitive and, on iOS, expiring, and whichever write lands
        // last is the one the user pastes.
        const offered = handOverCode();

        // `offered` only means a return scheme was present — a fire-and-forget
        // scheme navigation cannot be acknowledged — so it is not proof the
        // clipboard holds anything. Only the local write is.
        if (!(copied || offered)) return;

        trackEvent("install_code_copied", {
            merchant_id: merchantId,
            handed_off: offered,
        });
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
                    <InstallCodeHero
                        t={t}
                        installed={installed}
                        codeless={codeless}
                        merchantName={merchantInfo?.name}
                    />
                </section>

                {isLoading && (
                    <Stack space="m" align="center">
                        <Spinner />
                        <Text variant="bodySmall" color="secondary">
                            {t("installCode.loading")}
                        </Text>
                    </Stack>
                )}

                {data?.code && !visibleCode && (
                    <button
                        type="button"
                        className={styles.installedCodeToggle}
                        onClick={() => setShowCodeAfterInstall(true)}
                    >
                        {t("installCode.installedCodeToggle")}
                    </button>
                )}

                {visibleCode && (
                    <Stack space="m" align="center">
                        <CodeInput value={visibleCode} mode="alphanumeric" />
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

            {visibleCode && <InstallCodeInfoCard t={t} />}

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
