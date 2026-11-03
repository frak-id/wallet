import type { ReactNode } from "react";
import { merchant } from "@/data/merchant";
import * as styles from "./chrome.css";

/** Instagram's in-app browser: close, page title over the domain, overflow menu. */
export function InAppBrowserChrome({
    url,
    children,
}: {
    url: string;
    children: ReactNode;
}) {
    const domain = url.split("/")[0] ?? url;
    return (
        <div className={styles.browser}>
            <div className={styles.inAppHeader}>
                <span className={styles.iconButton} aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 18 18">
                        <title>Close</title>
                        <path
                            d="M2 2l14 14M16 2 2 16"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                </span>
                <span className={styles.inAppTitle}>
                    <span className={styles.inAppName}>{merchant.name}</span>
                    <span className={styles.inAppDomain}>
                        <svg width="9" height="11" viewBox="0 0 9 11">
                            <title>Secure</title>
                            <path
                                fill="currentColor"
                                d="M1.5 5V3.5a3 3 0 0 1 6 0V5h.3c.4 0 .7.3.7.7v4.6c0 .4-.3.7-.7.7H1.2a.7.7 0 0 1-.7-.7V5.7c0-.4.3-.7.7-.7h.3Zm1.3 0h3.4V3.5a1.7 1.7 0 0 0-3.4 0V5Z"
                            />
                        </svg>
                        {domain}
                    </span>
                </span>
                <span className={styles.iconButton} aria-hidden="true">
                    <svg width="20" height="4" viewBox="0 0 20 4">
                        <title>More</title>
                        <circle cx="2" cy="2" r="2" fill="currentColor" />
                        <circle cx="10" cy="2" r="2" fill="currentColor" />
                        <circle cx="18" cy="2" r="2" fill="currentColor" />
                    </svg>
                </span>
            </div>
            <div className={styles.viewport}>{children}</div>
            <div className={styles.inAppBottom} />
        </div>
    );
}
