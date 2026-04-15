export const allWelcomeSlideIds = ["intro", "notifications"] as const;

export type WelcomeSlideId = (typeof allWelcomeSlideIds)[number];

export type IntroWelcomeSlide = {
    id: WelcomeSlideId;
    kind: "intro";
    title: string;
    items: string[];
};

export type NotificationWelcomeSlide = {
    id: WelcomeSlideId;
    kind: "notifications";
    title: string;
    actionI18nKey: string;
    onAction: () => void | Promise<void>;
    isActionPending: boolean;
};

export type WelcomeSlide = IntroWelcomeSlide | NotificationWelcomeSlide;
