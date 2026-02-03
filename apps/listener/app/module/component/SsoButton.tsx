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
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { useStore } from "zustand";
import { useSsoLink } from "@/module/hooks/useSsoLink";
import { useListenerWithRequestUI } from "@/module/providers/ListenerUiProvider";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";

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
    const { startTimeout, clearTimeout: clearPairingTimeout } =
        useMountedTimeout();
    const client = getOriginPairingClient();
    const clientState = useStore(client.store);
    const resolvingContext = useStore(resolvingContextStore, (s) => s.context);

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
            emitLifecycleEvent({
                iframeLifecycle: "redirect",
                data: { baseRedirectUrl: deepLinkHref },
            });
            setStatus("waiting");
        }
    }, [deepLinkHref, status]);

    useEffect(() => {
        if (clientState.status === "paired") {
            clearPairingTimeout();
        }
    }, [clientState.status, clearPairingTimeout]);

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
                emitLifecycleEvent({
                    iframeLifecycle: "redirect",
                    data: { baseRedirectUrl: deepLinkHref },
                });
                setStatus("waiting");
            }}
            disabled={!deepLinkHref}
        >
            {t("mobile-sso.openWallet")}
        </button>
    );
}
