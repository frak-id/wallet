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
}: BannerPreviewProps) {
    return (
        <div className={styles.bannerContainer}>
            <div className={styles.bannerIconWrapper}>
                <GiftIcon width={40} height={40} />
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
                            d="M13.8984 11.144C13.9864 11.052 14.1543 11.1114 14.1543 11.2388V11.644C14.1543 13.0509 12.6288 14.1918 10.7471 14.1919C8.86523 14.1919 7.33984 13.051 7.33984 11.644V11.2388C7.33984 11.1114 7.50675 11.052 7.59473 11.144C8.3452 11.9295 9.47906 12.4292 10.7471 12.4292C12.0149 12.4291 13.148 11.9293 13.8984 11.144ZM1.8457 9.64795C1.8457 9.51169 2.01094 9.44452 2.10254 9.54053C2.85304 10.3238 3.98586 10.8247 5.25293 10.8247C5.52246 10.8247 5.78608 10.8026 6.04102 10.7593C6.25744 10.7225 6.46582 10.8816 6.46582 11.1011V12.1704C6.46564 12.319 6.36769 12.4507 6.22266 12.4829C5.91535 12.5512 5.58981 12.5874 5.25293 12.5874C3.3711 12.5874 1.8457 11.4469 1.8457 10.0396V9.64795ZM10.7471 6.20654C12.6288 6.20666 14.1543 7.3475 14.1543 8.75439C14.1541 10.1612 12.6287 11.3012 10.7471 11.3013C8.86535 11.3013 7.34004 10.1612 7.33984 8.75439C7.33984 7.34743 8.86523 6.20654 10.7471 6.20654ZM1.8457 6.8501C1.84597 6.71385 2.01208 6.64848 2.10352 6.74365C2.85393 7.52827 3.98602 8.0278 5.25293 8.02783C5.52282 8.02783 5.78667 8.00448 6.04199 7.96143C6.258 7.92499 6.46582 8.08514 6.46582 8.3042V9.37256C6.46582 9.52127 6.36783 9.65378 6.22266 9.68604C5.91537 9.75429 5.58979 9.79053 5.25293 9.79053C3.3711 9.79048 1.8457 8.64863 1.8457 7.24268V6.8501ZM5.25293 1.80811C7.13481 1.80811 8.66016 2.94856 8.66016 4.35596C8.66008 5.76331 7.13476 6.90381 5.25293 6.90381C3.37115 6.90376 1.84578 5.76328 1.8457 4.35596C1.8457 2.94858 3.3711 1.80815 5.25293 1.80811Z"
                            fill="currentColor"
                        />
                    </svg>
                </span>
            </div>
            <GiftIcon
                className={styles.postPurchaseGiftIcon}
                width={80}
                height={80}
            />
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
