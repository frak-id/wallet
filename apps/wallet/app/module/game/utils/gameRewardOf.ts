import type { RedeemResult } from "@frak-labs/wallet-shared";

/** EURe the redemption queued for the caller: the drop's reward plus the signup's. */
export function gameRewardOf(result: RedeemResult): number {
    return (result.drop?.reward ?? 0) + (result.signupReward ?? 0);
}
