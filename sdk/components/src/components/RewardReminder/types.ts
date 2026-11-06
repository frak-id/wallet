/**
 * The props type for {@link RewardReminder}.
 * @inline
 */
export type RewardReminderProps = {
    /**
     * Placement ID reported with the reminder's analytics events.
     */
    placement?: string;
    /**
     * CSS class names added to the floating root element.
     */
    classname?: string;
    /**
     * Side of the screen. Wins over the merchant dashboard and the SDK config.
     * @defaultValue `"left"`
     */
    position?: "left" | "right";
    /**
     * Override the expanded card heading. Supports `{REWARD}`, `{DAYS}`, `{DATE}`, `{BRAND}`.
     */
    heading?: string;
    /**
     * Override the expanded card description. Supports the same placeholders.
     */
    description?: string;
    /**
     * Override the claim button text. Supports the same placeholders.
     */
    cta?: string;
    /**
     * When set, renders with sample data and no fetch (e.g. in a theme editor).
     */
    preview?: string;
};
