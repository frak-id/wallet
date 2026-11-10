import type { ProductId } from "@/data/merchant";
import type { PersonaId } from "@/data/personas";

/*
 * Props of every screen the story engine (`src/core/steps.tsx`) mounts.
 * Each surface owns its implementation; the shapes here are the seam between
 * them, so they only change together with `steps.tsx`.
 */

// Merchant website (maisonlune.fr), rendered inside a browser chrome.
export type StoreHomeProps = Record<string, never>;
export type ProductPageProps = {
    productId: ProductId;
    /** Shows the Frak referral banner: the visitor arrived through a shared link. */
    referred: boolean;
    /** `express` swaps "add to cart" for a one-tap Apple Pay buy. */
    mode: "standard" | "express";
};
export type CartPageProps = { persona: PersonaId };
export type CheckoutPageProps = {
    persona: PersonaId;
    /** Opens the Apple Pay sheet on mount instead of showing the full form first. */
    express: boolean;
};
export type PostPurchaseCardState =
    /** Referrer, before sharing: "Earn 10 € by sharing". */
    | "referrer-share"
    /** Referrer, back from Instagram: the link is out, collect the earnings. */
    | "referrer-collect"
    /** Referee, after buying through the link: "You just earned 5 €". */
    | "referee-reward";
export type ThankYouPageProps = {
    persona: PersonaId;
    card: PostPurchaseCardState;
};

// Frak sharing page (wallet.frak.id/sharing), iOS share sheet, Instagram.
export type FrakSharingPageProps = {
    /** Rendered as a static backdrop under another sheet: no interaction, no entrance animation. */
    inert?: boolean;
};
export type ShareSheetProps = Record<string, never>;
export type StoryComposerProps = Record<string, never>;
export type InstagramFeedProps = Record<string, never>;
export type StoryViewerProps = Record<string, never>;

// Frak wallet: install page, app onboarding, wallet home.
export type InstallPageProps = { persona: PersonaId };
export type OnboardingProps = Record<string, never>;
export type PasskeyCreationProps = { persona: PersonaId };
export type ExpressClaimProps = { persona: PersonaId };
/** First "transfer to my bank": Monerium's account setup, then its identity check pending. */
export type CashOutSetupProps = { persona: PersonaId };
/** Amount → recap → Face ID → "on its way"; the bank's push lands on top and opens the bank app. */
export type BankTransferProps = { persona: PersonaId };
export type WalletPhase =
    /** Léa once Chloé has bought: the 10 € are hers to collect. */
    | "referrer-earned"
    /** Léa at the finale: the 10 € collected, then sent to her bank. */
    | "referrer-transferred"
    /** Chloé after her purchase: 5 € to collect. */
    | "referee-earned";
export type WalletHomeProps = {
    persona: PersonaId;
    phase: WalletPhase;
    /** Drawn behind a sheet or in the finale: reward already collected, no celebration, no modals. */
    embedded?: boolean;
    /** Once the reward is collected, "Transfer to my bank" moves the story on. */
    cashOut?: boolean;
};

// Léa's bank app.
/** Léa's bank app (fictional bank), the Frak transfer on top of her history. */
export type BankAppProps = { persona: PersonaId };
