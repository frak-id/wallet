import type { Address } from "viem";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering";
import type { NotificationPayload } from "@/types/NotificationPayload";

export type PushSchedule = {
    /** `""` until the merchant picks an option (no radio preselected). */
    type: "" | "now" | "later";
    /** ISO date string from the DateField (local midnight); empty unless scheduled. */
    date: string;
    /** `HH:mm` from `<input type="time">`; empty unless scheduled. */
    time: string;
};

export type FormCreatePushNotification = {
    /**
     * Id of the scheduled broadcast being edited. Set when the composer is
     * opened from "Edit" on a planned notification — drives an update instead
     * of a fresh create on save. Undefined for brand-new notifications.
     */
    editingId?: string;
    pushCampaignTitle: string;
    payload: NotificationPayload;
    target?:
        | {
              wallets: Address[];
          }
        | {
              filter: FormMembersFiltering;
          };
    targetCount: number;
    schedule: PushSchedule;
};
