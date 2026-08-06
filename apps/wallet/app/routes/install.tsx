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
import {
    decodeHostEmbed,
    type HostEmbed,
    isHostEmbedded,
} from "@/module/common/utils/hostEmbed";
import { sanitizeReturnScheme } from "@/module/common/utils/sanitizeReturnScheme";
import { useExecutePendingActions } from "@/module/pending-actions/hook/useExecutePendingActions";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { useGenerateInstallCode } from "@/module/recovery-code/hook/useGenerateInstallCode";
import { sendHostResult } from "@/module/sharing/host/bridge";
import * as styles from "./install.css";

type InstallSearch = {
    m?: string;
    a?: string;
    /** `frak-install-v1` proof, when a fragment could not carry it. See `resolveInstallProof`. */
    p?: string;
    /** `native` means a host embedded this page, so it draws no chrome of its own. */
    embed?: HostEmbed;
    /** Native host's result scheme. Present only when the SDK's web view loaded this page. */
    returnScheme?: string;
    /** The host's correlation token, echoed back with any result. */
    sid?: string;
};

export const Route = createFileRoute("/install")({
    validateSearch: (search: Record<string, unknown>): InstallSearch => ({
        m: typeof search.m === "string" ? search.m : undefined,
        a: typeof search.a === "string" ? search.a : undefined,
        p: typeof search.p === "string" ? search.p : undefined,
        embed: decodeHostEmbed(search.embed),
        // Sanitised: the page navigates to whatever scheme this carries; an
        // unvalidated value would turn a wallet-origin page into an arbitrary
        // scheme launcher.
        returnScheme: sanitizeReturnScheme(search.returnScheme),
        sid: typeof search.sid === "string" ? search.sid : undefined,
    }),
    component: InstallPage,
});

/**
 * Parses the `frak-install-v1` proof from the URL fragment (`#p=...`), which is
 * never sent to a server, never logged, never in a `Referer`. Never throws: a
 * malformed or missing fragment means "no proof".
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
 * The install proof for this visit. The fragment wins, but it cannot survive an
 * in-app navigation and the Play referrer carries none, so those handoffs use
 * `?p=` instead.
 */
export function resolveInstallProof(
    hash: string,
    searchProof?: string
): string | undefined {
    return parseInstallProofFragment(hash) ?? searchProof;
}

/**
 * Install page: install code + store links for a logged-out web visitor,
 * processing screen otherwise.
 */
function InstallPage() {
    const { m, a, p, embed, returnScheme, sid } = Route.useSearch();
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
    return <InstallProcessing m={m} a={a} proof={proof} />;
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
 * Exported for direct testing. A missing proof degrades silently, never blocks.
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
 * Brief processing screen around the ensure call, then on to `/wallet` or
 * `/register`. Always shown for at least MIN_PROCESSING_MS to avoid a flash.
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
    embed,
    returnScheme,
    sid,
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
                    {t("installCode.download")}
                </ExternalLink>
            </footer>
        </div>
    );
}
