/**
 * The supported interaction type keys
 *
 * - `referral` - User arrived via a referral link
 * - `create_referral_link` - User created/shared a referral link
 * - `purchase` - User completed a purchase
 * - `custom.${string}` - Custom interaction type defined per campaign
 *
 * @inline
 */
export type InteractionTypeKey =
    | "referral"
    | "create_referral_link"
    | "purchase"
    | `custom.${string}`;
