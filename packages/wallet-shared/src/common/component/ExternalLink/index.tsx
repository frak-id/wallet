import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { type ComponentProps, type MouseEvent, useCallback } from "react";
import { openExternalUrl } from "../../utils/openExternalUrl";

type Props = Omit<ComponentProps<"a">, "target" | "rel"> & { href: string };

/**
 * Anything else — notably `javascript:`, `data:` and `vbscript:` — is an XSS
 * sink once bound to an `href`, and several call sites pass merchant-authored
 * URLs straight through.
 */
const ALLOWED_PROTOCOLS = new Set(["https:", "http:", "mailto:", "tel:"]);

function isAllowedHref(href: string): boolean {
    try {
        return ALLOWED_PROTOCOLS.has(new URL(href).protocol);
    } catch {
        // Relative hrefs carry no scheme, and callers legitimately pass paths.
        return !/^[a-z][a-z0-9+.-]*:/i.test(href);
    }
}

/**
 * Anchor that opens external URLs (https/http/mailto/tel) through the
 * platform-appropriate handler. On the web it behaves like a standard
 * `target="_blank"` link; on Tauri it routes through the `opener` plugin via
 * `getInvoke()` so the OS handles the scheme (system browser, mail composer,
 * dialer, …).
 *
 * A URL with any other scheme renders as inert text: the label stays visible,
 * but nothing is clickable. Enforced here rather than trusted from the caller
 * because merchant-authored values reach this component.
 */
export function ExternalLink({ href, onClick, children, ...rest }: Props) {
    const handleClick = useCallback(
        async (e: MouseEvent<HTMLAnchorElement>) => {
            onClick?.(e);
            if (e.defaultPrevented) return;
            if (IS_TAURI) {
                e.preventDefault();
                await openExternalUrl(href);
            }
        },
        [href, onClick]
    );
    if (!isAllowedHref(href)) {
        const { className } = rest;
        return <span className={className}>{children}</span>;
    }

    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={handleClick}
            {...rest}
        >
            {children}
        </a>
    );
}
