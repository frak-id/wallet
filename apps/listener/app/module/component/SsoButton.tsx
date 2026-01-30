import {
    DEEP_LINK_SCHEME,
    type SsoMetadata,
    ssoPopupFeatures,
    ssoPopupName,
} from "@frak-labs/core-sdk";
import {
    emitLifecycleEvent,
    getOriginPairingClient,
    trackAuthFailed,
    trackAuthInitiated,
    ua,
    useSsoLink,
} from "@frak-labs/wallet-shared";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { useStore } from "zustand";
import { useListenerWithRequestUI } from "@/module/providers/ListenerUiProvider";

function buildDeepLinkHref(pairing: { id: string; code: string }): string {
    const id = encodeURIComponent(pairing.id);
    const code = encodeURIComponent(pairing.code);
    return `${DEEP_LINK_SCHEME}pair?id=${id}&code=${code}`;
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
        return <MobileSsoButton text={text} className={className} />;
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
                // Try to open the sso window
                const openedWindow = window.open(
                    link,
                    ssoPopupName,
                    ssoPopupFeatures
                );
                // If we got a window, focus it and save the clicked state
                if (openedWindow) {
                    openedWindow.focus();
                    trackAuthInitiated("sso", { method: "popup" });
                } else {
                    // Otherwise, mark that we fail to open it
                    setFailToOpen(true);
                    trackAuthFailed("sso", "failed-to-open");
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
 * Mobile SSO button using WebSocket pairing.
 * User clicks → WS pairing initiated → deep link shown → wallet app authenticates via WS.
 */
function MobileSsoButton({
    text,
    className,
}: {
    text: ReactNode;
    className?: string;
}) {
    const { t } = useTranslation();
    const [status, setStatus] = useState<
        "idle" | "connecting" | "waiting" | "timeout"
    >("idle");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);
    const client = getOriginPairingClient();
    const clientState = useStore(client.store);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            client.disconnect();
        };
    }, [client]);

    const handleStartPairing = () => {
        trackAuthInitiated("sso", { method: "mobile" });
        setStatus("connecting");

        client.initiatePairing(() => {
            if (!mountedRef.current) return;
        });

        timeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            // Check if already paired (race: WS paired but React hasn't re-rendered yet)
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
            emitLifecycleEvent({
                iframeLifecycle: "redirect",
                data: { baseRedirectUrl: deepLinkHref },
            });
            setStatus("waiting");
        }
    }, [deepLinkHref, status]);

    useEffect(() => {
        if (clientState.status === "paired" && timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, [clientState.status]);

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
                {text}
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

    if (deepLinkHref) {
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
                    emitLifecycleEvent({
                        iframeLifecycle: "redirect",
                        data: { baseRedirectUrl: deepLinkHref },
                    });
                    setStatus("waiting");
                }}
            >
                {t("mobile-sso.openWallet")}
            </button>
        );
    }

    return (
        <button type="button" className={className} disabled>
            {text}
        </button>
    );
}
