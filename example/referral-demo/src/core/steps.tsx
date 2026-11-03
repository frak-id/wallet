import type { ReactNode } from "react";
import type { PersonaId } from "@/data/personas";
import { Finale } from "@/stage/Finale";
import { Launcher } from "@/stage/Launcher";
import { PersonaIntro } from "@/stage/PersonaIntro";
import {
    CartPage,
    CheckoutPage,
    ProductPage,
    StoreHome,
    ThankYouPage,
} from "@/surfaces/merchant";
import {
    FrakSharingPage,
    InstagramFeed,
    ShareSheet,
    StoryComposer,
    StoryViewer,
} from "@/surfaces/social";
import {
    ExpressClaim,
    InstallPage,
    Onboarding,
    PasskeyCreation,
    WalletHome,
} from "@/surfaces/wallet";
import { STEP_IDS, type StepId } from "./stepIds";

export type Chrome =
    /** The demo's own screens: launcher, persona intros, finale. */
    | { kind: "stage" }
    /** Mobile Safari around a web page. */
    | { kind: "safari"; url: string }
    /** Instagram's in-app browser around a web page. */
    | { kind: "inAppBrowser"; url: string }
    /** A native app drawing edge to edge. */
    | { kind: "app"; app: "instagram" | "wallet" };

export type StepDef = {
    id: StepId;
    /** Whose phone this is; `null` on stage screens. */
    persona: PersonaId | null;
    chrome: Chrome;
    /** Status bar glyph colour: `dark` on light screens, `light` on dark ones. */
    statusBar: "dark" | "light";
    /** `instant` when the screen animates its own entrance (sheets over a backdrop). */
    enter?: "slide" | "fade" | "instant";
    /** Shows the "continue to the next scenario" prompt once the screen settles. */
    final?: boolean;
    render: () => ReactNode;
};

const STORE = "maisonlune.fr";
const WALLET = "wallet.frak.id";

const defs: { [K in StepId]: Omit<StepDef, "id"> } = {
    home: {
        persona: null,
        chrome: { kind: "stage" },
        statusBar: "light",
        render: () => <Launcher />,
    },
    "referrer.intro": {
        persona: "lea",
        chrome: { kind: "stage" },
        statusBar: "light",
        render: () => <PersonaIntro persona="lea" />,
    },
    "referrer.storeHome": {
        persona: "lea",
        chrome: { kind: "safari", url: STORE },
        statusBar: "dark",
        render: () => <StoreHome />,
    },
    "referrer.product": {
        persona: "lea",
        chrome: { kind: "safari", url: `${STORE}/products/serum-eclat` },
        statusBar: "dark",
        render: () => (
            <ProductPage productId="serum" referred={false} mode="standard" />
        ),
    },
    "referrer.cart": {
        persona: "lea",
        chrome: { kind: "safari", url: `${STORE}/cart` },
        statusBar: "dark",
        render: () => <CartPage persona="lea" />,
    },
    "referrer.checkout": {
        persona: "lea",
        chrome: { kind: "safari", url: `${STORE}/checkout` },
        statusBar: "dark",
        render: () => <CheckoutPage persona="lea" express={false} />,
    },
    "referrer.thankYou": {
        persona: "lea",
        chrome: { kind: "safari", url: `${STORE}/checkout/thank-you` },
        statusBar: "dark",
        render: () => <ThankYouPage persona="lea" card="referrer-share" />,
    },
    "referrer.sharing": {
        persona: "lea",
        chrome: { kind: "safari", url: `${WALLET}/sharing` },
        statusBar: "dark",
        render: () => <FrakSharingPage />,
    },
    "referrer.shareSheet": {
        persona: "lea",
        chrome: { kind: "safari", url: `${WALLET}/sharing` },
        statusBar: "dark",
        enter: "instant",
        render: () => <ShareSheet />,
    },
    "referrer.storyComposer": {
        persona: "lea",
        chrome: { kind: "app", app: "instagram" },
        statusBar: "light",
        render: () => <StoryComposer />,
    },
    "referrer.thankYouShared": {
        persona: "lea",
        chrome: { kind: "safari", url: `${STORE}/checkout/thank-you` },
        statusBar: "dark",
        render: () => <ThankYouPage persona="lea" card="referrer-collect" />,
    },
    "referrer.install": {
        persona: "lea",
        chrome: { kind: "safari", url: `${WALLET}/install` },
        statusBar: "dark",
        render: () => <InstallPage persona="lea" />,
    },
    "referrer.onboarding": {
        persona: "lea",
        chrome: { kind: "app", app: "wallet" },
        statusBar: "dark",
        render: () => <Onboarding />,
    },
    "referrer.passkey": {
        persona: "lea",
        chrome: { kind: "app", app: "wallet" },
        statusBar: "dark",
        enter: "fade",
        render: () => <PasskeyCreation persona="lea" />,
    },
    "referrer.wallet": {
        persona: "lea",
        chrome: { kind: "app", app: "wallet" },
        statusBar: "dark",
        enter: "fade",
        final: true,
        render: () => <WalletHome persona="lea" phase="referrer-pending" />,
    },
    "referee.intro": {
        persona: "chloe",
        chrome: { kind: "stage" },
        statusBar: "light",
        render: () => <PersonaIntro persona="chloe" />,
    },
    "referee.feed": {
        persona: "chloe",
        chrome: { kind: "app", app: "instagram" },
        statusBar: "dark",
        render: () => <InstagramFeed />,
    },
    "referee.story": {
        persona: "chloe",
        chrome: { kind: "app", app: "instagram" },
        statusBar: "light",
        enter: "fade",
        render: () => <StoryViewer />,
    },
    "referee.landing": {
        persona: "chloe",
        chrome: { kind: "inAppBrowser", url: `${STORE}/products/serum-eclat` },
        statusBar: "dark",
        render: () => (
            <ProductPage productId="serum" referred={true} mode="express" />
        ),
    },
    "referee.checkout": {
        persona: "chloe",
        chrome: { kind: "inAppBrowser", url: `${STORE}/checkout` },
        statusBar: "dark",
        render: () => <CheckoutPage persona="chloe" express={true} />,
    },
    "referee.thankYou": {
        persona: "chloe",
        chrome: { kind: "inAppBrowser", url: `${STORE}/checkout/thank-you` },
        statusBar: "dark",
        render: () => <ThankYouPage persona="chloe" card="referee-reward" />,
    },
    "referee.claim": {
        persona: "chloe",
        chrome: { kind: "safari", url: `${WALLET}/claim` },
        statusBar: "dark",
        render: () => <ExpressClaim persona="chloe" />,
    },
    "referee.wallet": {
        persona: "chloe",
        chrome: { kind: "safari", url: `${WALLET}/wallet` },
        statusBar: "dark",
        enter: "fade",
        final: true,
        render: () => <WalletHome persona="chloe" phase="referee-earned" />,
    },
    finale: {
        persona: null,
        chrome: { kind: "stage" },
        statusBar: "light",
        render: () => <Finale />,
    },
};

export const steps = Object.fromEntries(
    STEP_IDS.map((id) => [id, { id, ...defs[id] }])
) as { [K in StepId]: StepDef };

/** Two consecutive steps sharing this key keep their chrome mounted. */
export function chromeKey(step: StepDef): string {
    switch (step.chrome.kind) {
        case "stage":
            return `stage:${step.id}`;
        case "app":
            return `app:${step.chrome.app}:${step.persona}`;
        default:
            return `${step.chrome.kind}:${step.persona}`;
    }
}
