import {
    DEEP_LINK_SCHEME,
    type SsoMetadata,
    ssoPopupFeatures,
    ssoPopupName,
} from "@frak-labs/core-sdk";
import {
    emitLifecycleEvent,
    getOriginPairingClient,
    type OriginIdentityNode,
    trackAuthFailed,
    trackAuthInitiated,
    ua,
    useMountedTimeout,
} from "@frak-labs/wallet-shared";
import {
    type ReactNode,
    type RefObject,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { useStore } from "zustand";
import { useDeepLinkFallback } from "@/module/hooks/useDeepLinkFallback";
import { useSsoLink } from "@/module/hooks/useSsoLink";
import { useListenerWithRequestUI } from "@/module/providers/ListenerUiProvider";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";

function buildDeepLinkHref(pairing: { id: string }): string {
    const id = encodeURIComponent(pairing.id);
    return `${DEEP_LINK_SCHEME}pair?id=${id}&mode=embedded`;
}

/**
 * Try to open SSO popup and track result
 * @returns true if popup opened successfully
 */
function tryOpenSsoPopup(link: string): boolean {
    const openedWindow = window.open(link, ssoPopupName, ssoPopupFeatures);
    if (openedWindow) {
        openedWindow.focus();
        trackAuthInitiated("sso", { method: "popup" });
        return true;
    }
    trackAuthFailed("sso", "failed-to-open");
    return false;
}

/**
 * Button used to launch an SSO registration
 *
 * Performance note:
 * - Removed useConsumePendingSso hook (backend polling eliminated)
 * - SSO completion now handled via direct window postMessage
 * - Session updates trigger via sessionAtom changes
 *
 */
export function SsoButton({
    merchantId,
    ssoMetadata,
    text,
    className,
}: {
    merchantId: Hex;
    ssoMetadata: SsoMetadata;
    text: string;
    className?: string;
}) {
    // Get the current listener context (with a request)
    const {
        currentRequest: { appName },
        translation: { lang },
    } = useListenerWithRequestUI();

    // Parent page URL — used as redirect target after mobile SSO
    const sourceUrl = useStore(
        resolvingContextStore,
        (s) => s.context?.sourceUrl
    );

    // SSO link: popup mode (directExit) for desktop, redirect mode for mobile
    // On mobile we navigate the parent page to SSO, so we need a redirectUrl
    // to bring the user back to the merchant site after auth completes.
    const { link } = useSsoLink({
        merchantId,
        metadata: {
            name: appName,
            ...ssoMetadata,
        },
        ...(ua.isMobile ? { redirectUrl: sourceUrl } : { directExit: true }),
        lang,
    });

    if (!link) {
        return null;
    }

    // On mobile, use deep link redirect flow instead of popup
    if (ua.isMobile) {
        return (
            <MobileSsoButton link={link} text={text} className={className} />
        );
    }

    return <RegularSsoButton link={link} text={text} className={className} />;
}

function RegularSsoButton({
    link,
    text,
    className,
}: {
    link: string;
    text: ReactNode;
    className?: string;
}) {
    const [failToOpen, setFailToOpen] = useState(false);

    // If we failed to open the SSO modal, fallback to a link
    if (failToOpen) {
        return <LinkSsoButton link={link} text={text} className={className} />;
    }

    return (
        <button
            type={"button"}
            className={className}
            onClick={() => {
                if (!tryOpenSsoPopup(link)) {
                    setFailToOpen(true);
                }
            }}
        >
            {text}
        </button>
    );
}

/**
 * SSO button using a simple link, with sharing status
 */
function LinkSsoButton({
    link,
    text,
    className,
}: {
    link: string;
    text: ReactNode;
    className?: string;
}) {
    return (
        <a
            href={link}
            className={className}
            target="frak-sso"
            rel="noreferrer"
            onClick={() => {
                trackAuthInitiated("sso", { method: "link" });
            }}
        >
            {text}
        </a>
    );
}

/**
 * Whether the SSO redirect should be suppressed.
 * True when the native app was opened (page went hidden),
 * the attempt is stale, or pairing already succeeded.
 */
function shouldSuppressSsoRedirect(
    attemptId: number,
    attemptIdRef: RefObject<number>,
    didHideRef: RefObject<boolean>,
    client: ReturnType<typeof getOriginPairingClient>
): boolean {
    if (attemptId !== attemptIdRef.current) return true;
    if (didHideRef.current) return true;
    if (document.hidden) return true;
    if (client.store.getState().status === "paired") return true;
    return false;
}

function MobileSsoButton({
    link,
    text,
    className,
}: {
    link: string;
    text: ReactNode;
    className?: string;
}) {
    const { t } = useTranslation();
    const [status, setStatus] = useState<
        "idle" | "connecting" | "waiting" | "timeout"
    >("idle");
    const { startTimeout, clearTimeout: clearPairingTimeout } =
        useMountedTimeout();
    const {
        startTimeout: startSsoRedirectTimeout,
        clearTimeout: clearSsoRedirectTimeout,
    } = useMountedTimeout();
    const client = getOriginPairingClient();
    const clientState = useStore(client.store);
    const resolvingContext = useStore(resolvingContextStore, (s) => s.context);
    const { emitRedirectWithFallback } = useDeepLinkFallback();

    // Track whether the page was hidden (native app opened)
    const didHideRef = useRef(false);
    // Monotonic counter to invalidate stale SSO redirect attempts
    const attemptIdRef = useRef(0);
    const originNode = useMemo((): OriginIdentityNode | undefined => {
        if (!resolvingContext?.clientId || !resolvingContext?.merchantId) {
            return undefined;
        }
        return {
            type: "anonymous_fingerprint",
            value: resolvingContext.clientId,
            merchantId: resolvingContext.merchantId,
        };
    }, [resolvingContext?.clientId, resolvingContext?.merchantId]);

    // Cancel SSO redirect when page goes hidden (app was opened)
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.hidden) {
                didHideRef.current = true;
                clearSsoRedirectTimeout();
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("pagehide", onVisibilityChange);
        return () => {
            document.removeEventListener(
                "visibilitychange",
                onVisibilityChange
            );
            window.removeEventListener("pagehide", onVisibilityChange);
        };
    }, [clearSsoRedirectTimeout]);

    useEffect(() => {
        return () => {
            client.disconnect();
        };
    }, [client]);

    const handleStartPairing = async () => {
        trackAuthInitiated("sso", { method: "mobile" });
        setStatus("connecting");

        // Reset visibility tracking for this new attempt
        didHideRef.current = false;
        attemptIdRef.current += 1;

        try {
            client.disconnect();
            await client.initiatePairing({ originNode });
        } catch {
            setStatus("idle");
            trackAuthFailed("sso", "pairing-init-failed");
            return;
        }

        startTimeout(() => {
            if (client.store.getState().status === "paired") {
                return;
            }
            setStatus("timeout");
            trackAuthFailed("sso", "pairing-timeout");
        }, 30_000);
    };

    const deepLinkHref = clientState.pairing
        ? buildDeepLinkHref(clientState.pairing)
        : undefined;

    // Build a deferred SSO fallback that waits 5s and checks
    // whether the native app was actually opened before redirecting.
    const buildDeferredSsoFallback = useCallback(
        () => () => {
            const id = attemptIdRef.current;
            startSsoRedirectTimeout(() => {
                if (
                    shouldSuppressSsoRedirect(
                        id,
                        attemptIdRef,
                        didHideRef,
                        client
                    )
                )
                    return;
                // App genuinely not installed — redirect parent to SSO
                clearPairingTimeout();
                emitLifecycleEvent({
                    iframeLifecycle: "redirect",
                    data: { baseRedirectUrl: link },
                });
            }, 5_000);
        },
        [startSsoRedirectTimeout, clearPairingTimeout, link, client]
    );

    useEffect(() => {
        if (deepLinkHref && status === "connecting") {
            emitRedirectWithFallback(deepLinkHref, buildDeferredSsoFallback());
            setStatus("waiting");
        }
    }, [
        deepLinkHref,
        status,
        emitRedirectWithFallback,
        buildDeferredSsoFallback,
    ]);

    useEffect(() => {
        if (clientState.status === "paired") {
            clearPairingTimeout();
            clearSsoRedirectTimeout();
        }
    }, [clientState.status, clearPairingTimeout, clearSsoRedirectTimeout]);

    if (status === "idle") {
        return (
            <button
                type="button"
                className={className}
                onClick={handleStartPairing}
            >
                {text}
            </button>
        );
    }

    if (status === "timeout") {
        return (
            <button
                type="button"
                className={className}
                onClick={handleStartPairing}
            >
                {t("mobile-sso.retry")}
            </button>
        );
    }

    if (status === "connecting" && !deepLinkHref) {
        return (
            <button type="button" className={className} disabled>
                {t("mobile-sso.connecting")}
            </button>
        );
    }

    if (status === "waiting") {
        return (
            <button type="button" className={className} disabled>
                {t("mobile-sso.waiting")}
            </button>
        );
    }

    return (
        <button
            type="button"
            className={className}
            onClick={() => {
                if (!deepLinkHref) return;
                emitRedirectWithFallback(deepLinkHref, () => {
                    emitLifecycleEvent({
                        iframeLifecycle: "redirect",
                        data: { baseRedirectUrl: link },
                    });
                });
                setStatus("waiting");
            }}
            disabled={!deepLinkHref}
        >
            {t("mobile-sso.openWallet")}
        </button>
    );
}
