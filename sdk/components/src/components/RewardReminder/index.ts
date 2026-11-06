import { registerWebComponent } from "@/webcomponent/registerWebComponent";
import { RewardReminder } from "./RewardReminder";
import type { RewardReminderProps } from "./types";

export { RewardReminder };

/** Custom element type for `<frak-reward-reminder>`: {@link HTMLElement} plus {@link RewardReminderProps}. */
export type RewardReminderElement = HTMLElement & RewardReminderProps;

declare global {
    interface HTMLElementTagNameMap {
        "frak-reward-reminder": RewardReminderElement;
    }
}

registerWebComponent(
    RewardReminder,
    "frak-reward-reminder",
    [
        "placement",
        "classname",
        "position",
        "heading",
        "description",
        "cta",
        "preview",
    ],
    { shadow: true }
);
