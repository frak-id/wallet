import type { ReactNode } from "react";
import type { Chrome } from "@/core/steps";
import * as styles from "./chrome.css";
import { InAppBrowserChrome } from "./InAppBrowserChrome";
import { SafariChrome } from "./SafariChrome";

/** Wraps a screen in what the phone shows around it: a browser, or nothing. */
export function ChromeFrame({
    chrome,
    children,
}: {
    chrome: Chrome;
    children: ReactNode;
}) {
    switch (chrome.kind) {
        case "safari":
            return <SafariChrome url={chrome.url}>{children}</SafariChrome>;
        case "inAppBrowser":
            return (
                <InAppBrowserChrome url={chrome.url}>
                    {children}
                </InAppBrowserChrome>
            );
        case "app":
            return (
                <div className={styles.bare({ app: chrome.app })}>
                    {children}
                </div>
            );
        case "stage":
            return (
                <div className={styles.bare({ app: "stage" })}>{children}</div>
            );
    }
}
