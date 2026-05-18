import type { NotificationPayload } from "@/types/NotificationPayload";
import type { Address } from "viem";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering";

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
};
