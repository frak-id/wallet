import { type Currency, formatAmount } from "@frak-labs/core-sdk";
import type { loader as rootLoader } from "app/routes/app";
import { useRouteLoaderData } from "react-router";
import styles from "./index.module.css";

/**
 * Replace {{ estimatedReward }} and {{ productName }} with mock values for preview
 */
function replaceVariables(
    text: string,
    currency: Currency,
    shopName: string
): string {
    if (!text) return "";
    return text
        .replace(/\{\{\s*estimatedReward\s*\}\}/g, formatAmount(42, currency))
        .replace(/\{\{\s*productName\s*\}\}/g, shopName);
}

/**
 * Hook to get preview context (currency + shop name) from root loader
 */
function usePreviewContext() {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const currency = (rootData?.shop?.preferredCurrency ?? "usd") as Currency;
    const shopName = rootData?.shop?.name ?? "My Store";
    return { currency, shopName };
}

type SharingPreviewProps = {
    rewardTitle: string;
    rewardTagline: string;
};

/**
 * Preview of the sharing page initial state (reward card + share/copy buttons)
 */
export function SharingPreview({
    rewardTitle,
    rewardTagline,
}: SharingPreviewProps) {
    const { currency, shopName } = usePreviewContext();

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

type ConfirmationPreviewProps = {
    confirmationTitle: string;
    confirmationCta: string;
};

/**
 * Preview of the post-share confirmation state (hero title + CTA button)
 */
export function ConfirmationPreview({
    confirmationTitle,
    confirmationCta,
}: ConfirmationPreviewProps) {
    const { currency, shopName } = usePreviewContext();

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
