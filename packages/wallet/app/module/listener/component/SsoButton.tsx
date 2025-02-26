import { useConsumePendingSso } from "@/module/authentication/hook/useConsumePendingSso";
import {
    ssoPopupFeatures,
    ssoPopupName,
    useSsoLink,
} from "@/module/authentication/hook/useGetOpenSsoLink";
import { trackEvent } from "@/module/common/utils/trackEvent";
import { useListenerWithRequestUI } from "@/module/listener/providers/ListenerUiProvider";
import type { SsoMetadata } from "@frak-labs/core-sdk";
import { type ReactNode, useState } from "react";
import type { Hex } from "viem";

/**
 * Button used to launch an SSO registration
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
    defaultText,
    className,
}: {
    productId: Hex;
    ssoMetadata: SsoMetadata;
    text?: string;
    defaultText?: string;
    className?: string;
}) {
    // Get the current listener context (with a request)
    const {
        currentRequest: { appName },
        translation: { lang },
    } = useListenerWithRequestUI();

    // Get the link to use with the SSO
    const { link, trackingId } = useSsoLink({
        productId,
        metadata: {
            name: appName,
            ...ssoMetadata,
        },
        directExit: true,
        useConsumeKey: true,
        lang,
    });

    // Consume the pending sso if possible (maybe some hook to early exit here? Already working since we have the session listener)
    useConsumePendingSso({
        trackingId,
        productId,
    });

    if (!link) {
        return null;
    }

    return (
        <RegularSsoButton
            link={link}
            text={text ?? defaultText}
            className={className}
        />
    );
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
        return (
            <>
                <LinkSsoButton link={link} text={text} className={className} />
            </>
        );
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
                } else {
                    // Otherwise, mark that we fail to open it
                    setFailToOpen(true);
                }
                trackEvent("cta-sso");
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
                trackEvent("cta-sso");
            }}
        >
            {text}
        </a>
    );
}
