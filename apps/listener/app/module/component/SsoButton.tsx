import {
    DEEP_LINK_SCHEME,
    type SsoMetadata,
    ssoPopupFeatures,
    ssoPopupName,
} from "@frak-labs/core-sdk";
import {
    getOriginPairingClient,
    type OriginIdentityNode,
    trackAuthFailed,
    trackAuthInitiated,
    ua,
    useMountedTimeout,
} from "@frak-labs/wallet-shared";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { useStore } from "zustand";
import { useDeepLinkFallback } from "@/module/hooks/useDeepLinkFallback";
import { useSsoLink } from "@/module/hooks/useSsoLink";
import { useListenerWithRequestUI } from "@/module/providers/ListenerUiProvider";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import styles from "./SsoButton.module.css";

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

    // Get the link to use with the SSO
    const { link } = useSsoLink({
        merchantId,
        metadata: {
            name: appName,
            ...ssoMetadata,
        },
        directExit: true,
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
        "idle" | "connecting" | "waiting" | "timeout" | "appNotFound"
    >("idle");
    const { startTimeout, clearTimeout: clearPairingTimeout } =
        useMountedTimeout();
    const client = getOriginPairingClient();
    const clientState = useStore(client.store);
    const resolvingContext = useStore(resolvingContextStore, (s) => s.context);
    const { emitRedirectWithFallback } = useDeepLinkFallback();

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

    useEffect(() => {
        return () => {
            client.disconnect();
        };
    }, [client]);

    const handleStartPairing = async () => {
        trackAuthInitiated("sso", { method: "mobile" });
        setStatus("connecting");

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

    useEffect(() => {
        if (deepLinkHref && status === "connecting") {
            emitRedirectWithFallback(deepLinkHref, () => {
                // App not installed - show UI for manual browser continuation
                // (can't auto-open popup from callback - browsers block non-user-initiated popups)
                setStatus("appNotFound");
                // Clear pairing timeout since user will continue in browser
                clearPairingTimeout();
            });
            setStatus("waiting");
        }
    }, [deepLinkHref, status, emitRedirectWithFallback, clearPairingTimeout]);

    useEffect(() => {
        if (clientState.status === "paired") {
            clearPairingTimeout();
        }
    }, [clientState.status, clearPairingTimeout]);

    const handleContinueInBrowser = () => {
        tryOpenSsoPopup(link);
        setStatus("waiting");
    };

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

    if (status === "appNotFound") {
        return (
            <div className={styles.appNotFound}>
                <p className={styles.appNotFound__text}>
                    {t("mobile-sso.appNotFound")}
                </p>
                <button
                    type="button"
                    className={className}
                    onClick={handleContinueInBrowser}
                >
                    {t("mobile-sso.continueInBrowser")}
                </button>
            </div>
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
                    setStatus("appNotFound");
                });
                setStatus("waiting");
            }}
            disabled={!deepLinkHref}
        >
            {t("mobile-sso.openWallet")}
        </button>
    );
}
