import type { PrepareSsoParamsType } from "@frak-labs/core-sdk";
import { prepareSsoUrl } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { useQuery } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/**
 * Hook that builds the SSO popup URL ahead of the user's click.
 *
 * Wraps {@link @frak-labs/core-sdk!actions.prepareSsoUrl | `prepareSsoUrl()`}
 * in a {@link @tanstack/react-query!useQuery | `useQuery()`}, so the URL is
 * resolved while the page is idle. Handing the result to `useOpenSso()` as
 * `{ ssoUrl }` lets the popup open in the same tick as the click, which is
 * what keeps popup blockers out of the flow.
 *
 * @param params - SSO parameters for URL generation
 *
 * @group hooks
 *
 * @returns The query wrapping the `prepareSsoUrl()` action, resolving to
 * `{ ssoUrl }`
 *
 * @example
 * ```tsx
 * const { data } = usePrepareSsoUrl({ metadata });
 * const { mutate: openSso } = useOpenSso();
 *
 * <button
 *     disabled={!data}
 *     onClick={() => data && openSso({ ssoUrl: data.ssoUrl })}
 * >
 *     Login
 * </button>
 * ```
 *
 * @remarks
 * The URL embeds a proof-of-possession valid for 10 minutes. Past that the SSO
 * still opens and the user still logs in — only the anonymous-to-wallet
 * identity link is lost. On a page that can sit open for a long time, refetch
 * rather than holding one URL indefinitely.
 *
 * @see {@link @frak-labs/core-sdk!actions.prepareSsoUrl | `prepareSsoUrl()`} for the underlying action
 * @see {@link useOpenSso | `useOpenSso()`} for opening the prepared URL
 */
export function usePrepareSsoUrl(params: PrepareSsoParamsType) {
    const client = useFrakClient();

    return useQuery({
        queryKey: ["frak-sdk", "prepare-sso-url", params],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }
            return prepareSsoUrl(client, params);
        },
        enabled: !!client,
    });
}
