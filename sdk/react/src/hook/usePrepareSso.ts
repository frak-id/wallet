import type { PrepareSsoParamsType } from "@frak-labs/core-sdk";
import { prepareSso } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { useQuery } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/**
 * Hook that asks the wallet for an SSO URL without opening the popup
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.prepareSso | `prepareSso()`} action
 *
 * @param params - SSO parameters for URL generation
 *
 * @group hooks
 *
 * @returns
 * The query hook wrapping the `prepareSso()` action, its `data` carrying the
 * generated `ssoUrl`
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { data, isSuccess } = usePrepareSso({
 *     metadata: { logoUrl: "..." },
 *     directExit: true
 *   });
 *
 *   const handleClick = () => {
 *     if (data?.ssoUrl) {
 *       window.open(data.ssoUrl, "_blank");
 *     }
 *   };
 *
 *   return <button onClick={handleClick} disabled={!isSuccess}>Login</button>;
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
