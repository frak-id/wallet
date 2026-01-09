import {
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

/**
 * Button used to launch an SSO registration
 *
 * Performance note:
 * - Removed useConsumePendingSso hook (backend polling eliminated)
 * - SSO completion now handled via direct window postMessage
 * - Session updates trigger via sessionAtom changes
 *
 * @param appName
 * @param productId
 * @param ssoMetadata
 * @param text
 * @param defaultText
 * @param lang
 * @param className
 * @constructor
 */
export function SsoButton({
    productId,
    ssoMetadata,
    text,
    className,
}: {
    productId: Hex;
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
        productId,
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
                productId={productId}
                productName={appName}
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
                    trackAuthInitiated("sso");
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
                trackAuthInitiated("sso");
            }}
        >
            {text}
        </a>
    );
}

function MobileSsoButton({
    productId,
    productName,
    text,
    className,
}: {
    productId: Hex;
    productName: string;
    text: ReactNode;
    className?: string;
}) {
    const handleClick = () => {
        trackAuthInitiated("sso");

        const state = generateState();
        sessionStorage.setItem("frak_auth_state", state);

        // Use document.referrer as return URL (the page that loaded this iframe)
        const returnUrl = document.referrer || window.location.href;
        const deepLinkUrl = buildMobileLoginUrl({
            returnUrl,
            productId,
            state,
            productName,
        });

        // Use iframe lifecycle redirect event (handled by SDK)
        // Use parent origin from referrer for security (avoid "*")
        const targetOrigin = new URL(returnUrl).origin;
        window.parent.postMessage(
            {
                iframeLifecycle: "redirect",
                data: { baseRedirectUrl: deepLinkUrl },
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
    productId,
    state,
    productName,
}: {
    returnUrl: string;
    productId: string;
    state: string;
    productName?: string;
}): string {
    const params = new URLSearchParams();
    params.set("returnUrl", returnUrl);
    params.set("productId", productId);
    params.set("state", state);
    if (productName) params.set("productName", productName);

    return `frakwallet://login?${params.toString()}`;
}
