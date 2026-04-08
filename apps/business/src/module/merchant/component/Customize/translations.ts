import type { ComponentType } from "./types";

export const COMPONENT_LABELS: Record<ComponentType, string> = {
    buttonShare: "Share Button",
    postPurchase: "Post Purchase",
    banner: "Banner",
};

/**
 * Translation groups for the embedded wallet flow (advanced — collapsed).
 */
export const EMBEDDED_TRANSLATION_GROUPS = {
    "Login Screen": [
        "sdk.wallet.login.text",
        "sdk.wallet.login.text_referred",
        "sdk.wallet.login.primaryAction",
    ],
    Onboarding: [
        "sdk.wallet.loggedIn.onboarding.welcome",
        "sdk.wallet.loggedIn.onboarding.share",
        "sdk.wallet.loggedIn.onboarding.share_referred",
    ],
} as const;

/**
 * Translation groups for the sharing page flow (primary — always visible).
 */
export const SHARING_PAGE_TRANSLATION_GROUPS = {
    "Sharing Page": [
        "sdk.sharingPage.dismiss",
        "sdk.sharingPage.reward.title",
        "sdk.sharingPage.reward.tagline",
    ],
    "Sharing Steps": [
        "sdk.sharingPage.steps.title",
        "sdk.sharingPage.steps.1",
        "sdk.sharingPage.steps.2",
        "sdk.sharingPage.steps.3",
    ],
    "Sharing FAQ": [
        "sdk.sharingPage.faq.title",
        "sdk.sharingPage.faq.q1",
        "sdk.sharingPage.faq.a1",
        "sdk.sharingPage.faq.q2",
        "sdk.sharingPage.faq.a2",
        "sdk.sharingPage.faq.q3",
        "sdk.sharingPage.faq.a3",
        "sdk.sharingPage.faq.q4",
        "sdk.sharingPage.faq.a4",
        "sdk.sharingPage.faq.q5",
        "sdk.sharingPage.faq.a5",
    ],
    "Post-Share Confirmation": [
        "sdk.sharingPage.confirmation.title",
        "sdk.sharingPage.confirmation.subtitle",
        "sdk.sharingPage.confirmation.benefits.wallet.title",
        "sdk.sharingPage.confirmation.benefits.wallet.description",
        "sdk.sharingPage.confirmation.benefits.notify.title",
        "sdk.sharingPage.confirmation.benefits.notify.description",
        "sdk.sharingPage.confirmation.benefits.cashout.title",
        "sdk.sharingPage.confirmation.benefits.cashout.description",
        "sdk.sharingPage.confirmation.cta",
        "sdk.sharingPage.confirmation.shareAgain",
    ],
} as const;

/**
 * Translation groups for the modal flow (advanced — collapsed by default).
 */
export const MODAL_TRANSLATION_GROUPS = {
    "Dismiss Step": [
        "sdk.modal.dismiss.primaryAction",
        "sdk.modal.dismiss.primaryAction_sharing",
    ],
    "Final Step": [
        "sdk.modal.final.title",
        "sdk.modal.final.title_reward",
        "sdk.modal.final.title_sharing",
        "sdk.modal.final.description",
        "sdk.modal.final.description_sharing",
        "sdk.modal.final.description_reward",
        "sdk.modal.final.dismissed.description",
        "sdk.modal.final.dismissed.description_sharing",
    ],
    "Login Step": [
        "sdk.modal.login.description",
        "sdk.modal.login.description_sharing",
        "sdk.modal.login.description_reward",
        "sdk.modal.login.primaryAction",
        "sdk.modal.login.secondaryAction",
        "sdk.modal.login.title",
        "sdk.modal.login.success",
    ],
    "Send Transaction Step": [
        "sdk.modal.sendTransaction.description",
        "sdk.modal.sendTransaction.primaryAction_one",
        "sdk.modal.sendTransaction.primaryAction_other",
        "sdk.modal.sendTransaction.title",
    ],
    "SIWE Authentication Step": [
        "sdk.modal.siweAuthenticate.description",
        "sdk.modal.siweAuthenticate.primaryAction",
        "sdk.modal.siweAuthenticate.title",
    ],
} as const;

/**
 * Combined groups for validation and payload building.
 */
export const ALL_TRANSLATION_GROUPS = {
    ...EMBEDDED_TRANSLATION_GROUPS,
    ...SHARING_PAGE_TRANSLATION_GROUPS,
    ...MODAL_TRANSLATION_GROUPS,
} as const;

export const TRANSLATION_KEY_META: Record<
    string,
    { label: string; description: string }
> = {
    "sdk.wallet.login.text": {
        label: "Login prompt",
        description:
            "Message shown to visitors who haven't connected their wallet yet",
    },
    "sdk.wallet.login.text_referred": {
        label: "Login prompt (referred visitor)",
        description:
            "Message shown to visitors who arrived via a referral link",
    },
    "sdk.wallet.login.primaryAction": {
        label: "Login button",
        description: "Text on the main login / connect button",
    },
    "sdk.wallet.loggedIn.onboarding.welcome": {
        label: "Welcome message",
        description: "Greeting shown after a user first connects their wallet",
    },
    "sdk.wallet.loggedIn.onboarding.share": {
        label: "Share prompt",
        description: "Message encouraging the user to share with friends",
    },
    "sdk.wallet.loggedIn.onboarding.share_referred": {
        label: "Share prompt (referred visitor)",
        description: "Share message for users who arrived via a referral link",
    },
    "sdk.modal.dismiss.primaryAction": {
        label: "Dismiss button",
        description: "Text on the dismiss / close button",
    },
    "sdk.modal.dismiss.primaryAction_sharing": {
        label: "Dismiss button (sharing)",
        description: "Dismiss button text during the sharing flow",
    },
    "sdk.modal.final.title": {
        label: "Final step title",
        description: "Heading shown on the last modal step",
    },
    "sdk.modal.final.title_reward": {
        label: "Final step title (reward)",
        description: "Heading when a reward is available",
    },
    "sdk.modal.final.title_sharing": {
        label: "Final step title (sharing)",
        description: "Heading during the sharing flow",
    },
    "sdk.modal.final.description": {
        label: "Final step description",
        description: "Body text on the last modal step",
    },
    "sdk.modal.final.description_sharing": {
        label: "Final step description (sharing)",
        description: "Body text during the sharing flow",
    },
    "sdk.modal.final.description_reward": {
        label: "Final step description (reward)",
        description: "Body text when a reward is available",
    },
    "sdk.modal.final.dismissed.description": {
        label: "Dismissed description",
        description: "Text shown after the user dismissed the modal",
    },
    "sdk.modal.final.dismissed.description_sharing": {
        label: "Dismissed description (sharing)",
        description: "Dismissed text during the sharing flow",
    },
    "sdk.modal.login.description": {
        label: "Login description",
        description: "Body text in the login modal",
    },
    "sdk.modal.login.description_sharing": {
        label: "Login description (sharing)",
        description: "Login body text during the sharing flow",
    },
    "sdk.modal.login.description_reward": {
        label: "Login description (reward)",
        description: "Login body text when a reward is available",
    },
    "sdk.modal.login.primaryAction": {
        label: "Login button",
        description: "Main action button in the login modal",
    },
    "sdk.modal.login.secondaryAction": {
        label: "Secondary button",
        description: "Alternative action button in the login modal",
    },
    "sdk.modal.login.title": {
        label: "Login title",
        description: "Heading of the login modal",
    },
    "sdk.modal.login.success": {
        label: "Login success",
        description: "Message shown after a successful login",
    },
    "sdk.modal.sendTransaction.description": {
        label: "Transaction description",
        description: "Body text in the transaction confirmation modal",
    },
    "sdk.modal.sendTransaction.primaryAction_one": {
        label: "Confirm button (single)",
        description: "Button text when confirming a single transaction",
    },
    "sdk.modal.sendTransaction.primaryAction_other": {
        label: "Confirm button (multiple)",
        description: "Button text when confirming multiple transactions",
    },
    "sdk.modal.sendTransaction.title": {
        label: "Transaction title",
        description: "Heading of the transaction confirmation modal",
    },
    "sdk.modal.siweAuthenticate.description": {
        label: "Authentication description",
        description: "Body text in the SIWE authentication modal",
    },
    "sdk.modal.siweAuthenticate.primaryAction": {
        label: "Authentication button",
        description: "Action button for SIWE authentication",
    },
    "sdk.modal.siweAuthenticate.title": {
        label: "Authentication title",
        description: "Heading of the SIWE authentication modal",
    },
    "sdk.sharingPage.dismiss": {
        label: "Dismiss button",
        description: "Text on the dismiss / later button on the sharing page",
    },
    "sdk.sharingPage.reward.title": {
        label: "Reward title",
        description: "Main heading in the reward card section",
    },
    "sdk.sharingPage.reward.tagline": {
        label: "Reward tagline",
        description:
            "Description below the reward title explaining the sharing incentive",
    },
    "sdk.sharingPage.steps.title": {
        label: "Steps title",
        description: "Heading above the step-by-step instructions",
    },
    "sdk.sharingPage.steps.1": {
        label: "Step 1",
        description: "First step instruction (share in 1 click)",
    },
    "sdk.sharingPage.steps.2": {
        label: "Step 2",
        description: "Second step instruction (earn on every purchase)",
    },
    "sdk.sharingPage.steps.3": {
        label: "Step 3",
        description: "Third step instruction (collect earnings)",
    },
    "sdk.sharingPage.faq.title": {
        label: "FAQ title",
        description: "Heading above the FAQ section",
    },
    "sdk.sharingPage.faq.q1": {
        label: "FAQ question 1",
        description: "First frequently asked question",
    },
    "sdk.sharingPage.faq.a1": {
        label: "FAQ answer 1",
        description: "Answer to the first question",
    },
    "sdk.sharingPage.faq.q2": {
        label: "FAQ question 2",
        description: "Second frequently asked question",
    },
    "sdk.sharingPage.faq.a2": {
        label: "FAQ answer 2",
        description: "Answer to the second question",
    },
    "sdk.sharingPage.faq.q3": {
        label: "FAQ question 3",
        description: "Third frequently asked question",
    },
    "sdk.sharingPage.faq.a3": {
        label: "FAQ answer 3",
        description: "Answer to the third question",
    },
    "sdk.sharingPage.faq.q4": {
        label: "FAQ question 4",
        description: "Fourth frequently asked question",
    },
    "sdk.sharingPage.faq.a4": {
        label: "FAQ answer 4",
        description: "Answer to the fourth question",
    },
    "sdk.sharingPage.faq.q5": {
        label: "FAQ question 5",
        description: "Fifth frequently asked question",
    },
    "sdk.sharingPage.faq.a5": {
        label: "FAQ answer 5",
        description: "Answer to the fifth question",
    },
    "sdk.sharingPage.confirmation.title": {
        label: "Confirmation title",
        description: "Heading shown after a successful share",
    },
    "sdk.sharingPage.confirmation.subtitle": {
        label: "Confirmation subtitle",
        description: "Description below the confirmation title",
    },
    "sdk.sharingPage.confirmation.benefits.wallet.title": {
        label: "Wallet benefit title",
        description: "Title for the wallet creation benefit",
    },
    "sdk.sharingPage.confirmation.benefits.wallet.description": {
        label: "Wallet benefit description",
        description: "Description for the wallet creation benefit",
    },
    "sdk.sharingPage.confirmation.benefits.notify.title": {
        label: "Notification benefit title",
        description: "Title for the earnings notification benefit",
    },
    "sdk.sharingPage.confirmation.benefits.notify.description": {
        label: "Notification benefit description",
        description: "Description for the earnings notification benefit",
    },
    "sdk.sharingPage.confirmation.benefits.cashout.title": {
        label: "Cashout benefit title",
        description: "Title for the cashout benefit",
    },
    "sdk.sharingPage.confirmation.benefits.cashout.description": {
        label: "Cashout benefit description",
        description: "Description for the cashout benefit",
    },
    "sdk.sharingPage.confirmation.cta": {
        label: "Confirmation CTA",
        description: "Call-to-action button text on the confirmation screen",
    },
    "sdk.sharingPage.confirmation.shareAgain": {
        label: "Share again link",
        description: "Secondary action to go back and share again",
    },
};

export const TRANSLATION_LANG_FIELDS = {
    default: "translationsDefault",
    en: "translationsEn",
    fr: "translationsFr",
} as const;
