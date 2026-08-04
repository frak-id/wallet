import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import {
    type CompressedSsoData,
    compressJsonToB64,
    decompressJsonFromB64,
    findIframeInOpener,
} from "@frak-labs/core-sdk";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { CircleCheckIcon } from "@frak-labs/design-system/icons";
import { createRpcClient } from "@frak-labs/frame-connector";
import type { SsoRpcSchema } from "@frak-labs/wallet-shared";
import {
    authenticationStore,
    clientIdStore,
    compressedSsoToParams,
    ensureFreshSdkSession,
    notifyWalletAuthExpired,
    openExternalUrl,
    PairingView,
    recordError,
    resolveWebauthnErrorView,
    sessionStore,
    ssoKey,
    useWebauthnErrorToast,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import i18next from "i18next";
import { useCallback, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useStore } from "zustand";
import * as layout from "@/module/authentication/component/authLayout.css";
import {
    BackToSessionAction,
    ContinueAsSession,
    PhonePairingAction,
} from "@/module/authentication/component/Sso/ContinueAsSession";
import * as styles from "@/module/authentication/component/Sso/index.css";
import { MerchantIcon } from "@/module/authentication/component/Sso/MerchantIcon";
import { SsoActions } from "@/module/authentication/component/Sso/SsoActions";
import { SsoDisclaimer } from "@/module/authentication/component/Sso/SsoDisclaimer";
import { SsoHeader } from "@/module/authentication/component/Sso/SsoHeader";
import { SsoSubtitle } from "@/module/authentication/component/Sso/SsoSubtitle";
import { Back } from "@/module/common/component/Back";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import { PageLayout } from "@/module/common/component/PageLayout";
import { StepLayout } from "@/module/common/component/StepLayout";
import { sanitizeRedirectUrl } from "@/module/common/utils/sanitizeRedirectUrl";

export const Route = createFileRoute("/_wallet/_sso/sso")({
    component: Sso,
    validateSearch: (search: Record<string, unknown>) => {
        return {
            p: (search.p as string) || undefined,
        };
    },
    beforeLoad: async ({ search }) => {
        const compressedString = search.p;
        if (!compressedString) {
            // If no SSO params, redirect to register
            throw redirect({ to: "/register", replace: true });
        }

        // Decompress the SSO parameters
        const compressedParam =
            decompressJsonFromB64<CompressedSsoData>(compressedString);
        if (!compressedParam) {
            // Return error to be handled gracefully by component
            return {
                error: new Error(
                    "Invalid SSO parameters. The link may be corrupted or expired."
                ),
            };
        }

        // Convert compressed params to full params
        const { merchantId, redirectUrl, directExit, lang, metadata, proof } =
            compressedSsoToParams(compressedParam);

        // Apply default for directExit: close the popup after completion
        // unless the caller provided a redirectUrl. This matches the SDK-side
        // default and protects against older SDK callers that omit the flag.
        const resolvedDirectExit = directExit ?? !redirectUrl;

        // Save the SSO context to the store
        authenticationStore.getState().setSsoContext({
            merchantId: merchantId || undefined,
            redirectUrl: redirectUrl ?? undefined,
            directExit: resolvedDirectExit,
            metadata: metadata ?? undefined,
            proof,
        });

        // Save the client id if provided
        if (compressedParam.cId) {
            clientIdStore.getState().setClientId(compressedParam.cId);
        }

        // Change language if provided and different from current
        if (lang && i18next.language !== lang) {
            await i18next.changeLanguage(lang);
        }

        return {
            ssoParams: {
                merchantId,
                redirectUrl,
                directExit: resolvedDirectExit,
                lang,
                metadata,
            },
        };
    },
});

function Sso() {
    const { t } = useTranslation();

    /**
     * Get route context to check for initialization errors
     * beforeLoad returns route context, not loader data
     */
    const routeContext = Route.useRouteContext();

    /**
     * The current metadata
     */
    const ssoContext = useStore(
        authenticationStore,
        (state) => state.ssoContext
    );
    const currentMetadata = useMemo(
        () => ssoContext?.metadata,
        [ssoContext?.metadata]
    );

    /**
     * Whether we know of a previously-used passkey on this device.
     */
    const lastAuthenticator = useStore(
        authenticationStore,
        (state) => state.lastAuthenticator
    );

    /**
     * The success state after login or register
     */
    const [success, setSuccess] = useState(false);

    /**
     * The loader error (from beforeLoad, unrecoverable)
     */
    const loaderError = (routeContext as { error?: Error })?.error ?? null;

    /**
     * The action error state (from login/register, retryable)
     */
    const [error, setError] = useState<Error | null>(null);
    useWebauthnErrorToast(error);

    /**
     * Current view: initial auth choices or QR-code pairing screen.
     */
    const [view, setView] = useState<"choose" | "pairing">("choose");

    /**
     * Whether we already have an active session in store — typically a
     * `distant-webauthn` from a prior pairing or a still-valid local
     * webauthn login. When true, the user can complete SSO with a single
     * click; no biometry / no re-pair.
     */
    const session = useStore(sessionStore, (state) => state.session);

    /**
     * One-shot opt-out: if the user clicks "Use another account", we keep
     * the existing session in store (so a paired desktop stays paired)
     * but render the standard login/register choices on this page only.
     */
    const [bypassSession, setBypassSession] = useState(false);
    const useSessionShortcut = !!session && !bypassSession;

    /**
     * Completion handler — runs after a successful auth (login / register /
     * pairing) or via the "Continue with my wallet" shortcut. Refreshes the SDK
     * token, hands the session to the listener iframe via RPC, then
     * redirects / closes.
     *
     * Wrapped in a mutation so `isCompleting` drives the CTA loading state: the
     * primary button is disabled while the handoff is in flight, which replaces
     * the old manual re-entrancy ref as the double-submit guard.
     */
    const { mutate: onSuccess, isPending: isCompleting } = useMutation({
        mutationKey: ssoKey.complete,
        async mutationFn() {
            // Renew the SDK token before handing it to the merchant. Under the
            // 1-day SDK TTL a returning or paired session can be carrying a
            // near-expired token; ensureFreshSdkSession mints a fresh one (a
            // no-op when still healthy) and writes it back to the store, so both
            // the RPC and redirect handoffs below pick up the freshened value.
            const fresh = await ensureFreshSdkSession();
            if (fresh.status === "dead") {
                // Wallet token is server-confirmed dead. Notify the re-auth
                // guard directly: the backendClient 401 hook only signals when
                // the wallet JWT is ALSO client-side expired, so a server-revoked
                // (but not yet expired) token would otherwise strand this popup
                // silently. The guard routes local sessions to the re-auth modal
                // and distant / ecdsa sessions to logout.
                //
                // Throw (don't return) so TanStack records this as an error,
                // not a success: returning undefined leaves the mutation
                // "successful", re-enabling the "Continue" CTA behind the
                // re-auth overlay and letting the user re-fire a dead handoff.
                notifyWalletAuthExpired();
                throw new Error("sso:wallet-auth-dead");
            }

            const session = sessionStore.getState().session;
            const sdkSession = sessionStore.getState().sdkSession;

            // Find the listener iframe and send RPC message if available
            if (session && sdkSession) {
                const listenerIframe = findIframeInOpener();

                if (listenerIframe) {
                    try {
                        // Create RPC client targeting the listener iframe
                        const ssoClient = createRpcClient<SsoRpcSchema>({
                            emittingTransport: listenerIframe,
                            listeningTransport: window,
                            targetOrigin: window.location.origin,
                        });

                        console.log(
                            "[SSO] Sent completion message to listener iframe via RPC",
                            {
                                address: session.address,
                            }
                        );

                        // Send SSO completion via RPC
                        await ssoClient.request({
                            method: "sso_complete",
                            params: [session, sdkSession],
                        });

                        // Cleanup the client
                        ssoClient.cleanup();
                    } catch (error) {
                        recordError(error, {
                            source: "sso",
                            context: { stage: "rpc_complete" },
                        });
                    }
                }
            }

            // Redirect the user in 2seconds
            setSuccess(true);
            setTimeout(() => {
                redirectOrClose();
            }, 2000);
        },
    });

    /**
     * Redirect or close after success
     */
    const redirectOrClose = useCallback(() => {
        // Check the current store context
        const ssoContext = authenticationStore.getState().ssoContext;
        // If we got a redirect, redirect to the page directly with success status
        if (ssoContext?.redirectUrl) {
            // Validate the redirect target (https-only, no open redirect) before
            // using it. sanitizeRedirectUrl strips the hash/query, so we rebuild
            // from the sanitized origin+pathname and re-add our own sso param.
            const safeRedirect = sanitizeRedirectUrl(
                decodeURIComponent(ssoContext.redirectUrl)
            );
            if (!safeRedirect) {
                recordError(new Error("Invalid SSO redirect URL"), {
                    source: "sso",
                    context: { stage: "redirect_validation" },
                });
                return;
            }
            const redirectUrl = new URL(safeRedirect);

            // Get the full SSO params and compress them for URL passthrough
            const session = sessionStore.getState().session;
            const sdkSession = sessionStore.getState().sdkSession;
            if (session && sdkSession) {
                // Compress to base64url for URL parameter
                const compressed = compressJsonToB64([session, sdkSession]);
                redirectUrl.searchParams.set("sso", compressed);
            }

            const url = redirectUrl.toString();
            if (IS_TAURI) {
                // On native, hand the redirect off to the system browser
                // and bring the user back to the wallet home so the app
                // doesn't get stranded on the merchant URL inside the webview.
                openExternalUrl(url).catch((error) => {
                    recordError(error, {
                        source: "sso",
                        context: { stage: "tauri_redirect" },
                    });
                });
                window.location.href = "/wallet";
                return;
            }
            window.location.href = url;
            return;
        }
        // If we got a direct exit, close this window
        if (ssoContext?.directExit) {
            window.close();
            return;
        }
    }, []);

    /**
     * Title shown in the hero — differs depending on whether the user has a
     * previously-registered passkey on this device.
     */
    const title = useMemo(
        () =>
            lastAuthenticator
                ? t("authent.sso.title_existing")
                : t("authent.sso.title_new"),
        [t, lastAuthenticator]
    );

    // Show error state if loader failed
    if (loaderError) {
        const view = resolveWebauthnErrorView(loaderError);
        return (
            <>
                <SsoHeader />
                <StepLayout
                    icon={<span>⚠️</span>}
                    title="An error occurred"
                    description={t(`${view.baseKey}.message`)}
                    footer={
                        <Button variant="ghost" onClick={() => window.close()}>
                            Close
                        </Button>
                    }
                />
            </>
        );
    }

    if (!currentMetadata) {
        return (
            <>
                <SsoHeader />
                <Spinner />
            </>
        );
    }

    // Success state — waiting for redirect/close
    if (success) {
        return (
            <>
                <SsoHeader />
                <StepLayout
                    icon={
                        <Box className={styles.successIcon}>
                            <CircleCheckIcon width={72} height={72} />
                        </Box>
                    }
                    title={title}
                    description={
                        <>
                            <Trans
                                i18nKey={"authent.sso.redirect"}
                                values={{
                                    productName: currentMetadata.name,
                                }}
                            />
                            <span className="dotsLoading">...</span>
                        </>
                    }
                    footer={
                        <Button variant="ghost" onClick={redirectOrClose}>
                            {t("authent.sso.redirectNow")}
                        </Button>
                    }
                />
            </>
        );
    }

    if (view === "pairing") {
        return (
            <PageLayout>
                <Box className={layout.contentTop}>
                    <PairingView
                        back={<Back onClick={() => setView("choose")} />}
                        title={t("authent.sso.pairing.title")}
                        description={t("authent.sso.pairing.description")}
                        onSuccess={onSuccess}
                    />
                </Box>
            </PageLayout>
        );
    }

    return (
        <PageLayout
            fixedViewport
            footer={
                <>
                    <Box className={layout.actions}>
                        {useSessionShortcut ? (
                            <ContinueAsSession
                                address={session.address}
                                productName={currentMetadata.name}
                                onContinue={onSuccess}
                                loading={isCompleting}
                                onUseAnother={() => setBypassSession(true)}
                            />
                        ) : (
                            <>
                                <SsoActions
                                    onSuccess={onSuccess}
                                    onError={setError}
                                />
                                <PhonePairingAction
                                    onClick={() => setView("pairing")}
                                />
                                {session && bypassSession && (
                                    <BackToSessionAction
                                        onClick={() => setBypassSession(false)}
                                    />
                                )}
                            </>
                        )}
                    </Box>
                    <SsoDisclaimer metadata={currentMetadata} />
                </>
            }
        >
            <SsoHeader />
            <Box className={layout.content}>
                <ContentBlock
                    icon={<MerchantIcon metadata={currentMetadata} />}
                    titleAs="h1"
                    title={title}
                    description={<SsoSubtitle metadata={currentMetadata} />}
                    contentSpacing="l"
                    textSpacing="m"
                />
            </Box>
        </PageLayout>
    );
}
