// Order matches the runtime render order in `WelcomeCard`
// (intro → notifications → invite). The tuple is only consumed for
// `WelcomeSlideId` derivation and `isWelcomeSlideId` validation, but
// keeping it aligned avoids confusion when a future reader greps for
// slide order.
export const allWelcomeSlideIds = ["intro", "notifications", "invite"] as const;

export type WelcomeSlideId = (typeof allWelcomeSlideIds)[number];

export type IntroWelcomeSlide = {
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
    actionI18nKey: string;
    onAction: () => void | Promise<void>;
    isActionPending: boolean;
};

export type WelcomeSlide =
    | IntroWelcomeSlide
    | InviteWelcomeSlide
    | NotificationWelcomeSlide;
