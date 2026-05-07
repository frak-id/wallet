import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { type ComponentProps, type MouseEvent, useCallback } from "react";
import { openExternalUrl } from "../../utils/openExternalUrl";

type Props = Omit<ComponentProps<"a">, "target" | "rel"> & { href: string };

/**
 * Anchor that opens external URLs (https/http/mailto/tel) through the
 * platform-appropriate handler. On the web it behaves like a standard
 * `target="_blank"` link; on Tauri it routes through `@tauri-apps/plugin-opener`
 * so the OS handles the scheme (system browser, mail composer, dialer, ...).
 */
export function ExternalLink({ href, onClick, children, ...rest }: Props) {
    const handleClick = useCallback(
        async (e: MouseEvent<HTMLAnchorElement>) => {
            onClick?.(e);
            if (e.defaultPrevented) return;
            if (isTauri()) {
                e.preventDefault();
                await openExternalUrl(href);
            }
        },
        [href, onClick]
    );
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
