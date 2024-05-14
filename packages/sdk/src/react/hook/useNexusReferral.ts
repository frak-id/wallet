import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { type Address, isAddressEqual } from "viem";
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
    const [walletAddress, setWalletAddress] = useState<Address>();

    const newStatusUpdated = useCallback(
        (event: SetUserReferredReturnType) => {
            queryClient.setQueryData(
                ["setUserReferredQueryReturnTypeListener"],
                event
            );

            // In case the user is referred successfully, remove the context from the url
            if (
                event.key === "referred-successful" ||
                event.key === "referred-history"
            ) {
                if (!href) return;
                const url = new URL(href);
                url.searchParams.delete("nexusContext");
                window.history.replaceState(null, "", url.toString());
            }
        },
        [queryClient, href]
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

        // If context is set, set the wallet address
        if (context) {
            setWalletAddress(context as Address);
        }
    }, [href, walletStatus]);

    return useQuery<SetUserReferredQueryReturnType>({
        gcTime: 0,
        queryKey: ["setUserReferredQueryReturnTypeListener"],
        queryFn: async () => {
            if (!(contentId && walletAddress)) {
                return { key: "no-referrer" };
            }

            if (
                walletStatus?.key === "connected" &&
                walletStatus?.wallet &&
                isAddressEqual(walletStatus?.wallet, walletAddress)
            ) {
                return { key: "same-wallet" };
            }

            // Setup the listener
            await setUserReferred(
                client,
                { contentId, walletAddress },
                newStatusUpdated
            );

            // Wait for the first response
            return { key: "waiting-response" };
        },
        enabled: !!contentId && !!walletAddress,
    });
}
