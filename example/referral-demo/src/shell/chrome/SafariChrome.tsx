import { motion } from "motion/react";
import type { ReactNode } from "react";
import * as styles from "./chrome.css";

function domainOf(url: string): string {
    return url.split("/")[0] ?? url;
}

/** Load bar replayed on every navigation, like Safari's. */
function LoadProgress({ url }: { url: string }) {
    return (
        <motion.span
            key={url}
            className={styles.progress}
            initial={{ width: "8%", opacity: 1 }}
            animate={{ width: "100%", opacity: [1, 1, 0] }}
            transition={{ duration: 0.7, ease: "easeOut", times: [0, 0.8, 1] }}
        />
    );
}

/** iOS Safari: page on top, compact toolbar with the address at the bottom. */
export function SafariChrome({
    url,
    children,
}: {
    url: string;
    children: ReactNode;
}) {
    return (
        <div className={styles.browser}>
            <div className={styles.safariTop} />
            <div className={styles.viewport}>{children}</div>
            <div className={styles.safariToolbar}>
                <span className={styles.roundButton} aria-hidden="true">
                    <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
                        <title>Back</title>
                        <path
                            d="M10 2 2 10l8 8"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>
                <span className={styles.urlPill}>
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        className={styles.urlMuted}
                    >
                        <title>Reader</title>
                        <path
                            fill="currentColor"
                            d="M2 3.5h12v1.5H2zm0 3.75h12v1.5H2zM2 11h8v1.5H2z"
                        />
                    </svg>
                    <span className={styles.urlText}>{domainOf(url)}</span>
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className={styles.urlMuted}
                    >
                        <title>Reload</title>
                        <path
                            d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <LoadProgress url={url} />
                </span>
                <span className={styles.roundButton} aria-hidden="true">
                    <svg width="20" height="4" viewBox="0 0 20 4">
                        <title>More</title>
                        <circle cx="2" cy="2" r="2" fill="currentColor" />
                        <circle cx="10" cy="2" r="2" fill="currentColor" />
                        <circle cx="18" cy="2" r="2" fill="currentColor" />
                    </svg>
                </span>
            </div>
        </div>
    );
}
