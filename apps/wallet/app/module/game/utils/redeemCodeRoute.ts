import { frakGame } from "@/module/game/config";

/** Where a signed-in user lands with a shared code: the game join screen while the game is on. */
export function redeemCodeRoute(code: string) {
    return {
        to: frakGame.enabled ? "/game/join" : "/profile/referral/redeem",
        search: { code },
    } as const;
}
