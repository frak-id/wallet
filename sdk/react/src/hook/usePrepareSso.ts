import type { PrepareSsoParamsType } from "@frak-labs/core-sdk";
import { prepareSso } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { useQuery } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/**
 * Hook that generates SSO URL for popup flow
 *
 * This is a **synchronous** hook (no async calls) that generates the SSO URL
 * client-side without communicating with the wallet iframe.
 *
 * @param params - SSO parameters for URL generation
 *
 * @group hooks
 *
 * @returns
 * Object containing:
 * - `ssoUrl`: Generated SSO URL (or undefined if client not ready)
 * - `isReady`: Boolean indicating if URL is available
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { data } = usePrepareSso({
 *     metadata: { logoUrl: "..." },
 *     directExit: true
 *   });
 *
 *   const handleClick = () => {
 *     if (ssoUrl) {
 *       window.open(data?.ssoUrl, "_blank");
 *     }
 *   };
 *
 *   return <button onClick={handleClick} disabled={!isReady}>Login</button>;
 * }
 * ```
 *
 * @see {@link @frak-labs/core-sdk!actions.prepareSso | `prepareSso()`} for the underlying action
 * @see {@link @frak-labs/core-sdk!actions.openSso | `openSso()`} for the recommended high-level API
 */
export function usePrepareSso(params: PrepareSsoParamsType) {
    const client = useFrakClient();

    return useQuery({
        queryKey: ["frak-sdk", "prepare-sso", params],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }
            return prepareSso(client, params);
        },
    });
}
