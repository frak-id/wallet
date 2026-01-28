import {
    DEEP_LINK_SCHEME,
    type SsoMetadata,
    ssoPopupFeatures,
    ssoPopupName,
} from "@frak-labs/core-sdk";
import {
    trackAuthFailed,
    trackAuthInitiated,
    ua,
    useSsoLink,
} from "@frak-labs/wallet-shared";
import { type ReactNode, useState } from "react";
import type { Hex } from "viem";
import { useListenerWithRequestUI } from "@/module/providers/ListenerUiProvider";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";

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
            <MobileSsoButton
                merchantId={merchantId}
                merchantName={appName}
                text={text}
                className={className}
            />
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
    merchantId,
    merchantName,
    text,
    className,
}: {
    merchantId: Hex;
    merchantName: string;
    text: ReactNode;
    className?: string;
}) {
    const handleClick = () => {
        trackAuthInitiated("sso", { method: "mobile" });

        const state = generateState();

        // Prefer resolving context (handshake-derived) as return URL.
        // This is more reliable than document.referrer under strict Referrer-Policy.
        const resolvingContext = resolvingContextStore.getState().context;
        const returnUrl =
            resolvingContext?.sourceUrl ??
            document.referrer ??
            window.location.href;
        const deepLinkUrl = buildMobileLoginUrl({
            returnUrl,
            merchantId,
            state,
            merchantName,
        });

        // Use iframe lifecycle redirect event (handled by SDK)
        // Use parent origin from referrer for security (avoid "*")
        const targetOrigin =
            resolvingContext?.origin ?? safeGetOrigin(returnUrl);
        if (!targetOrigin) {
            trackAuthFailed("sso", "invalid-return-url");
            return;
        }

        // Send redirect event with state so parent can store it in its sessionStorage
        window.parent.postMessage(
            {
                iframeLifecycle: "redirect",
                data: { baseRedirectUrl: deepLinkUrl, state },
            },
            targetOrigin
        );
    };

    return (
        <button type="button" className={className} onClick={handleClick}>
            {text}
        </button>
    );
}

function generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildMobileLoginUrl({
    returnUrl,
    merchantId,
    state,
    merchantName,
}: {
    returnUrl: string;
    merchantId: string;
    state: string;
    merchantName?: string;
}): string {
    const params = new URLSearchParams();
    params.set("returnUrl", returnUrl);
    params.set("merchantId", merchantId);
    params.set("state", state);
    if (merchantName) params.set("merchantName", merchantName);

    return `${DEEP_LINK_SCHEME}login?${params.toString()}`;
}

function safeGetOrigin(url: string): string | null {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}
