import type { RedeemResult } from "@frak-labs/wallet-shared";

/** EURe the redemption queued for the caller: the game's reward plus the signup's. */
export function gameRewardOf(result: RedeemResult): number {
    return (result.gameReward ?? 0) + (result.signupReward ?? 0);
}
