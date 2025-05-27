import type { FormCreatePushNotification } from "@/module/members/component/CreatePush";
import { atomWithStorage } from "jotai/utils";

/**
 * The current push creation form (post close or next actions on the form)
 */
export const currentPushCreationForm = atomWithStorage<
    FormCreatePushNotification | undefined
>("currentPushCampaignForm", undefined);
