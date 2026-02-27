import { type ReactNode, useCallback } from "react";

/**
 * Opens URL in a new tab via synchronous `window.open()`.
 *
 * Shopify web components (`s-link`, `s-button`) with `target="_blank"` route
 * through App Bridge's async postMessage — Safari blocks this as a popup.
 * Calling `window.open()` synchronously in the click handler keeps it within
 * the user gesture stack.
 */
export function ExternalLink({
    href,
    children,
}: {
    href: string;
    children: ReactNode;
}) {
    const handleClick = useCallback(() => {
        window.open(href, "_blank");
    }, [href]);

    return <s-link onClick={handleClick}>{children}</s-link>;
}

export function ExternalButton({
    href,
    variant,
    loading,
    disabled,
    children,
}: {
    href: string;
    variant?: "auto" | "primary" | "secondary" | "tertiary";
    loading?: boolean;
    disabled?: boolean;
    children: ReactNode;
}) {
    const handleClick = useCallback(() => {
        window.open(href, "_blank");
    }, [href]);

    return (
        <s-button
            variant={variant}
            loading={loading}
            disabled={disabled}
            onClick={handleClick}
        >
            {children}
        </s-button>
    );
}
