import type { CurrentGameResponse } from "@frak-labs/backend-elysia/domain/game/schemas";
import { referralStatusQueryOptions } from "@frak-labs/wallet-shared";
import { onlineManager, type QueryClient } from "@tanstack/react-query";
import { currentGameQueryOptions } from "@/module/game/hook/useCurrentGame";

export type JoinRedirect =
    | { to: "/game" }
    | { to: "/game/join"; search: { code?: string } }
    | { to: "/profile/referral/share" }
    | { to: "/profile/referral/redeem"; search: { code?: string } };

/** Where `/game/join` sends a shared code it cannot join with; `null` keeps the join screen. */
export function joinRedirectOf(
    current: CurrentGameResponse,
    code: string | undefined,
    ownCode: string | undefined
): JoinRedirect | null {
    const isOwn = code !== undefined && code === ownCode;
    if (current.game && !current.me.participating) {
        return isOwn ? { to: "/game/join", search: {} } : null;
    }
    if (current.game && (isOwn || !code)) return { to: "/game" };
    if (isOwn) return { to: "/profile/referral/share" };
    // Nothing left to join: a friend's code can only become the referrer.
    return { to: "/profile/referral/redeem", search: { code } };
}

/** `null` when the data cannot be read: the join screen then renders as is. */
export async function resolveJoinRedirect(
    queryClient: QueryClient,
    code: string | undefined
): Promise<JoinRedirect | null> {
    // Offline, a fetch pauses until the network returns, and the navigation with it.
    if (!onlineManager.isOnline()) return null;
    const [current, status] = await Promise.all([
        queryClient
            .fetchQuery(currentGameQueryOptions())
            .catch(() => undefined),
        code
            ? queryClient
                  .fetchQuery(referralStatusQueryOptions())
                  .catch(() => undefined)
            : undefined,
    ]);
    if (!current) return null;
    return joinRedirectOf(current, code, status?.ownedCode?.code);
}
