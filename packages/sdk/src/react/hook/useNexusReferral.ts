import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { isAddressEqual } from "viem";
import type { Address } from "viem";
import type {
    SetUserReferredParams,
    SetUserReferredReturnType,
} from "../../core";
import { setUserReferred } from "../../core/actions";
import { useNexusClient } from "./useNexusClient";
import { useWalletStatus } from "./useWalletStatus";
import { useWindowLocation } from "./useWindowLocation";

export type SetUserReferredQueryReturnType =
    | SetUserReferredReturnType
    | {
          key: "waiting-response";
      }
    | {
          key: "no-referrer";
      };

/**
 * Use the current nexus referral
 */
export function useNexusReferral({ contentId }: SetUserReferredParams) {
    const { href } = useWindowLocation();
    const queryClient = useQueryClient();
    const client = useNexusClient();
    const { data: walletStatus } = useWalletStatus();
    const [referrerAddress, setReferrerAddress] = useState<Address>();

    const newStatusUpdated = useCallback(
        (event: SetUserReferredReturnType) => {
            queryClient.setQueryData(
                ["setUserReferredQueryReturnTypeListener"],
                event
            );

            // In case the user is referred successfully
            if (
                event.key === "referred-successful" ||
                event.key === "referred-history"
            ) {
                if (!href) return;
                const url = new URL(href);

                // If user is connected, set the context in the url
                if (walletStatus?.key === "connected") {
                    url.searchParams.set("nexusContext", walletStatus?.wallet);
                }

                // If user is not connected, remove the context from the url
                if (walletStatus?.key === "not-connected") {
                    url.searchParams.delete("nexusContext");
                }

                window.history.replaceState(null, "", url.toString());
            }
        },
        [queryClient, href, walletStatus]
    );

    useEffect(() => {
        if (!href) return;

        const url = new URL(href);
        const context = url.searchParams.get("nexusContext");

        // If user is connected, set the context in the url
        if (!context && walletStatus?.key === "connected") {
            url.searchParams.set("nexusContext", walletStatus?.wallet);
            window.history.replaceState(null, "", url.toString());
        }

        // If context is set, set the referrer address
        if (context) {
            setReferrerAddress(context as Address);
        }
    }, [href, walletStatus]);

    return useQuery<SetUserReferredQueryReturnType>({
        gcTime: 0,
        queryKey: ["setUserReferredQueryReturnTypeListener"],
        queryFn: async () => {
            if (!(contentId && referrerAddress)) {
                return { key: "no-referrer" };
            }

            if (
                walletStatus?.key === "connected" &&
                walletStatus?.wallet &&
                isAddressEqual(walletStatus?.wallet, referrerAddress)
            ) {
                return { key: "same-wallet" };
            }

            // Setup the listener
            await setUserReferred(
                client,
                { contentId, walletAddress: referrerAddress },
                newStatusUpdated
            );

            // Wait for the first response
            return { key: "waiting-response" };
        },
        enabled:
            !!contentId &&
            !!referrerAddress &&
            walletStatus?.key !== undefined &&
            walletStatus?.key !== "waiting-response",
    });
}
