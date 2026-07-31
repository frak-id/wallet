import type {
    InteractionTypeKey,
    SharingPageProduct,
} from "@frak-labs/core-sdk";

/**
 * The props type for {@link ButtonShare}.
 * @inline
 */
export type ButtonShareProps = {
    placement?: string;
    /**
     * Text to display on the button.
     *
     * Including the placeholder `{REWARD}` (e.g. `Share and earn up to \{REWARD\}!`)
     * opts the button into the live reward flow: the SDK fetches the
     * estimated reward and substitutes the placeholder. When no reward is
     * available, `noRewardText` is used as a fallback (or the placeholder is
     * stripped if no fallback is provided).
     *
     * When omitted, a built-in localized default is used based on the
     * resolved language (`"Share & earn {REWARD}!"` / `"Partagez et gagnez
     * {REWARD} !"`) — mirroring the dashboard's first wording preset.
     */
    text?: string;
    /**
     * Classname to apply to the button
     */
    classname?: string;
    /**
     * Fallback text when `text` contains the `{REWARD}` placeholder but no
     * reward is available.
     */
    noRewardText?: string;
    /**
     * Target interaction behind this sharing action (will be used to get the right reward to display)
     */
    targetInteraction?: InteractionTypeKey;
    /**
     * Products currently in view, used to prefer a campaign whose
     * `productScope` matches one of them when picking the reward to advertise,
     * and forwarded to the sharing page so it can render product cards.
     *
     * Accepts a {@link SharingPageProduct} array (JS property) or a
     * JSON-stringified array (HTML attribute).
     */
    products?: SharingPageProduct[] | string;
    /**
     * Which UI to open on click.
     *
     * Legacy values (e.g. `"share-modal"`) are accepted at runtime and
     * gracefully route to the full-page sharing UI — the modal-flow
     * share path was retired in favour of `displaySharingPage`.
     *
     * @defaultValue `"sharing-page"`
     */
    clickAction?: "embedded-wallet" | "sharing-page";
    /**
     * When set, renders the button in preview mode (e.g. Shopify/WP editor).
     * Skips the client-ready gating so the button is always enabled visually,
     * and no-ops the click handler so merchants can see the final layout with
     * their configured copy even when no Frak client is initialized.
     */
    preview?: string;
};
