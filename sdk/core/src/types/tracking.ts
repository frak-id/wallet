/**
 * Types for arrival tracking and referral attribution
 * @category Tracking
 */

import type { Address } from "viem";

/**
 * UTM parameters for marketing attribution
 * @category Tracking
 */
export type UtmParams = {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
};

/**
 * Parameters for tracking an arrival event
 * @category Tracking
 */
export type TrackArrivalParams = {
    /**
     * The referrer wallet address (from fCtx URL param)
     */
    referrerWallet?: Address;
    /**
     * The landing page URL (defaults to current page)
     */
    landingUrl?: string;
    /**
     * UTM parameters for marketing attribution
     */
    utmParams?: UtmParams;
};

/**
 * Result from tracking an arrival event
 * @category Tracking
 */
export type TrackArrivalResult = {
    success: boolean;
    identityGroupId?: string;
    touchpointId?: string;
    error?: string;
};

/**
 * Internal params passed to the trackArrival action
 * Includes merchantId resolved from config or fetch
 * @internal
 */
export type TrackArrivalInternalParams = TrackArrivalParams & {
    /**
     * The merchant ID (UUID from dashboard)
     */
    merchantId: string;
};
