import {
    CartIcon,
    CheckIcon,
    InstagramIcon,
    ReferralIcon,
} from "@frak-labs/design-system/icons";
import type { DefaultTranslate } from "@frak-labs/wallet-shared/types";
import {
    MISSION_REWARDS,
    type Mission,
} from "@/module/game/utils/gameMissions";

export const ICONS = {
    join: CheckIcon,
    instagram: InstagramIcon,
    friend: ReferralIcon,
    purchase: CartIcon,
} as const satisfies Record<Mission["id"], unknown>;

export const REWARDS = {
    join: "game.page.missions.reward",
    instagram: "game.page.missions.reward",
    friend: "game.page.missions.rewardPerFriend",
    purchase: "game.page.missions.rewardPerPurchase",
} as const satisfies Record<Mission["id"], string>;

/** A mission's reward badge: "+2 tickets", "+1 ticket / friend"… */
export function rewardOf(t: DefaultTranslate, id: Mission["id"]) {
    return t(REWARDS[id], { count: MISSION_REWARDS[id] });
}
