import type { Currency } from "@frak-labs/core-sdk";
import { replaceVariables } from "../utils/variables";
import * as styles from "./styles.css";

export type SharingPreviewProps = {
    rewardTitle: string;
    rewardTagline: string;
    currency: Currency;
    shopName: string;
};

/**
 * Preview of the sharing page initial state (reward card + share/copy buttons)
 */
export function SharingPreview({
    rewardTitle,
    rewardTagline,
    currency,
    shopName,
}: SharingPreviewProps) {
    return (
        <div className={styles.previewContainer}>
            <div className={styles.header}>
                <span className={styles.headerLogo}>Frak</span>
                <span className={styles.dismissText}>Dismiss</span>
            </div>
            <div className={styles.rewardCard}>
                <p className={styles.rewardTitle}>
                    {replaceVariables(rewardTitle, currency, shopName)}
                </p>
                <p className={styles.rewardTagline}>
                    {replaceVariables(rewardTagline, currency, shopName)}
                </p>
            </div>
            <div className={styles.footer}>
                <div className={styles.shareButton}>
                    <span>↗</span>
                    <span>Share</span>
                </div>
                <div className={styles.copyButton}>
                    <span>🔗</span>
                    <span>Copy link</span>
                </div>
            </div>
        </div>
    );
}

export type ConfirmationPreviewProps = {
    confirmationTitle: string;
    confirmationCta: string;
    currency: Currency;
    shopName: string;
};

/**
 * Preview of the post-share confirmation state (hero title + CTA button)
 */
export function ConfirmationPreview({
    confirmationTitle,
    confirmationCta,
    currency,
    shopName,
}: ConfirmationPreviewProps) {
    return (
        <div className={styles.previewContainer}>
            <div className={styles.header}>
                <span className={styles.headerLogo}>Frak</span>
                <span className={styles.dismissText}>✕</span>
            </div>
            <div className={styles.heroSection}>
                <p className={styles.heroTitle}>
                    {replaceVariables(confirmationTitle, currency, shopName)}
                </p>
            </div>
            <div className={styles.confirmationFooter}>
                <div className={styles.ctaButton}>
                    {replaceVariables(confirmationCta, currency, shopName)}
                </div>
                <div className={styles.shareAgainButton}>Share again</div>
            </div>
        </div>
    );
}
