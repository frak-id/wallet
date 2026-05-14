import type { InteractionTypeKey } from "@frak-labs/core-sdk";

/**
 * The props type for {@link Banner}.
 * @inline
 */
export type BannerProps = {
    /**
     * Placement ID for backend-driven CSS customization.
     */
    placement?: string;
    /**
     * CSS class names passed through to the root element (Light DOM).
     */
    classname?: string;
    /**
     * Filter rewards by interaction type (e.g. "purchase", "referral").
     * When omitted, the best reward across all interaction types is shown.
     */
    interaction?: InteractionTypeKey;
    /**
     * Override the referral banner title.
     */
    referralTitle?: string;
    /**
     * Override the referral banner description.
     */
    referralDescription?: string;
    /**
     * Override the referral banner CTA button text.
     */
    referralCta?: string;
    /**
     * Override the in-app browser banner title.
     */
    inappTitle?: string;
    /**
     * Override the in-app browser banner description.
     */
    inappDescription?: string;
    /**
     * Override the in-app browser banner CTA button text.
     */
    inappCta?: string;
    /**
     * Override the image displayed on the left of the referral banner.
     * Accepts an image URL. Falls back to the built-in gift icon when omitted.
     * The image is constrained to the icon slot via `object-fit: contain`,
     * so any aspect ratio renders correctly.
     */
    imageUrl?: string;
    /**
     * When set, forces the banner to render in preview mode (e.g. in Shopify theme editor).
     * Bypasses normal event/browser detection and shows static content.
     */
    preview?: string;
    /**
     * Which banner variant to preview: "referral" or "inapp".
     * Only used when {@link preview} is set. Defaults to "referral".
     */
    previewMode?: "referral" | "inapp";
    /**
     * When `true` (default `false`), the banner is allowed to switch to
     * in-app browser mode (Instagram / Facebook WebView) and prompt the
     * user to escape to the system browser.
     *
     * Most flows now work inside in-app browsers via the anonymous-id
     * flow, so the redirect is opt-in. Enable it only on surfaces that
     * actually drive users into a WebAuthn-bound action (login,
     * sendTransaction, SIWE authenticate).
     *
     * Accepts the boolean `true` (TS/JSX) or the string `"true"` (HTML
     * attribute). Any other value — including `false`, `"false"`, the
     * empty string, or attribute absence — keeps the redirect disabled.
     */
    allowInappRedirect?: boolean | "true" | "false";
};
