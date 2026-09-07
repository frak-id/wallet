import type { TranslationKey } from "@frak-labs/wallet-shared/types";
// Order matches the runtime render order in `WelcomeCard`
// (intro → notifications → invite). The tuple is only consumed for
// `WelcomeSlideId` derivation and `isWelcomeSlideId` validation, but
// keeping it aligned avoids confusion when a future reader greps for
// slide order.
export const allWelcomeSlideIds = ["intro", "notifications", "invite"] as const;

export type WelcomeSlideId = (typeof allWelcomeSlideIds)[number];

type IntroWelcomeSlide = {
    id: WelcomeSlideId;
    kind: "intro";
    title: string;
    items: string[];
};

export type InviteWelcomeSlide = {
    id: WelcomeSlideId;
    kind: "invite";
    title: string;
    items: string[];
    onAction: () => void;
};

export type NotificationWelcomeSlide = {
    id: WelcomeSlideId;
    kind: "notifications";
    title: string;
    /**
     * The single key this slide renders. `Extract` rather than bare
     * `TranslationKey`: it stays one literal, so `Trans i18nKey` does not hit
     * TS's union complexity limit, but collapses to `never` if the key leaves
     * the locale JSON.
     */
    actionI18nKey: Extract<TranslationKey, "wallet.activateNotifications">;
    onAction: () => void;
};

export type WelcomeSlide =
    | IntroWelcomeSlide
    | InviteWelcomeSlide
    | NotificationWelcomeSlide;
