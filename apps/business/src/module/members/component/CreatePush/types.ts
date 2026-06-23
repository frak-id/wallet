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
