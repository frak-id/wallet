import type { Currency } from "@frak-labs/core-sdk";
import { replaceVariables } from "../utils/variables";
import { GiftIcon } from "./GiftIcon";
import * as styles from "./styles.css";

// ─── Banner Preview ─────────────────────────────────────

export type BannerPreviewProps = {
    title: string;
    description: string;
    ctaText: string;
    currency: Currency;
    shopName: string;
    /** Custom illustration URL replacing the built-in gift icon. */
    imageUrl?: string;
};

/**
 * Preview of the SDK referral banner component
 * Matches the white "referral mode" of <frak-banner>
 */
export function BannerPreview({
    title,
    description,
    ctaText,
    currency,
    shopName,
    imageUrl,
}: BannerPreviewProps) {
    return (
        <div className={styles.bannerContainer}>
            <div className={styles.bannerIconWrapper}>
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt=""
                        className={styles.bannerCustomImage}
                    />
                ) : (
                    <GiftIcon width={40} height={40} />
                )}
            </div>
            <div className={styles.bannerBody}>
                <p className={styles.bannerTitle}>
                    {replaceVariables(title, currency, shopName)}
                </p>
                <p className={styles.bannerDescription}>
                    {replaceVariables(description, currency, shopName)}
                </p>
                <span className={styles.bannerCta}>
                    {replaceVariables(ctaText, currency, shopName)}
                </span>
            </div>
        </div>
    );
}

// ─── Post-Purchase Preview ──────────────────────────────

export type PostPurchasePreviewProps = {
    messageText: string;
    ctaText: string;
    badgeText?: string;
    currency: Currency;
    shopName: string;
    /** Custom illustration URL replacing the built-in gift icon. */
    imageUrl?: string;
};

/**
 * Preview of the SDK post-purchase card component
 * Matches the layout of <frak-post-purchase>
 */
export function PostPurchasePreview({
    messageText,
    ctaText,
    badgeText,
    currency,
    shopName,
    imageUrl,
}: PostPurchasePreviewProps) {
    return (
        <div className={styles.postPurchaseCard}>
            <div className={styles.postPurchaseBody}>
                {badgeText && (
                    <span className={styles.postPurchaseBadge}>
                        {replaceVariables(badgeText, currency, shopName)}
                    </span>
                )}
                <p className={styles.postPurchaseMessage}>
                    {replaceVariables(messageText, currency, shopName)}
                </p>
                <span className={styles.postPurchaseCta}>
                    {replaceVariables(ctaText, currency, shopName)}
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M13.9 11.14C13.99 11.05 14.15 11.11 14.15 11.24V11.64C14.15 13.05 12.63 14.19 10.75 14.19C8.87 14.19 7.34 13.05 7.34 11.64V11.24C7.34 11.11 7.51 11.05 7.59 11.14C8.35 11.93 9.48 12.43 10.75 12.43C12.01 12.43 13.15 11.93 13.9 11.14ZM1.85 9.65C1.85 9.51 2.01 9.44 2.1 9.54C2.85 10.32 3.99 10.82 5.25 10.82C5.52 10.82 5.79 10.8 6.04 10.76C6.26 10.72 6.47 10.88 6.47 11.1V12.17C6.47 12.32 6.37 12.45 6.22 12.48C5.92 12.55 5.59 12.59 5.25 12.59C3.37 12.59 1.85 11.45 1.85 10.04V9.65ZM10.75 6.21C12.63 6.21 14.15 7.35 14.15 8.75C14.15 10.16 12.63 11.3 10.75 11.3C8.87 11.3 7.34 10.16 7.34 8.75C7.34 7.35 8.87 6.21 10.75 6.21ZM1.85 6.85C1.85 6.71 2.01 6.65 2.1 6.74C2.85 7.53 3.99 8.03 5.25 8.03C5.52 8.03 5.79 8 6.04 7.96C6.26 7.92 6.47 8.09 6.47 8.3V9.37C6.47 9.52 6.37 9.65 6.22 9.69C5.92 9.75 5.59 9.79 5.25 9.79C3.37 9.79 1.85 8.65 1.85 7.24V6.85ZM5.25 1.81C7.13 1.81 8.66 2.95 8.66 4.36C8.66 5.76 7.13 6.9 5.25 6.9C3.37 6.9 1.85 5.76 1.85 4.36C1.85 2.95 3.37 1.81 5.25 1.81Z"
                            fill="currentColor"
                        />
                    </svg>
                </span>
            </div>
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt=""
                    className={styles.postPurchaseCustomImage}
                />
            ) : (
                <GiftIcon
                    className={styles.postPurchaseGiftIcon}
                    width={80}
                    height={80}
                />
            )}
        </div>
    );
}

// ─── Share Button Preview ───────────────────────────────

export type ShareButtonPreviewProps = {
    text: string;
    currency: Currency;
    shopName: string;
};

/**
 * Preview of the SDK share button component
 * Matches the default appearance of <frak-button-share>
 */
export function ShareButtonPreview({
    text,
    currency,
    shopName,
}: ShareButtonPreviewProps) {
    return (
        <button type="button" className={styles.shareButton}>
            {replaceVariables(text, currency, shopName)}
        </button>
    );
}
