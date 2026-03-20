import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
    moneriumStore,
    selectAccessToken,
    selectProfileId,
    selectProfileState,
} from "@/module/monerium/store/moneriumStore";
import { getIbans } from "@/module/monerium/utils/moneriumApi";
import { useMoneriumTokenRefresh } from "./useMoneriumClient";

type IbanQueryResult = {
    iban: string | null;
    linkedAddress: string | null;
    isLinkedToWallet: boolean;
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useMoneriumIban() {
    const { address: walletAddress } = useAccount();
    const accessToken = moneriumStore(selectAccessToken);
    const profileState = moneriumStore(selectProfileState);
    const profileId = moneriumStore(selectProfileId);
    const { isReady } = useMoneriumTokenRefresh();

    const isEnabled = profileState === "approved" && isReady && !!accessToken;

    const query = useQuery({
        queryKey: ["monerium", "iban", profileId],
        queryFn: async (): Promise<IbanQueryResult> => {
            if (!accessToken) {
                return {
                    iban: null,
                    linkedAddress: null,
                    isLinkedToWallet: false,
                };
            }

            const { ibans } = await getIbans(accessToken);

            if (!ibans || ibans.length === 0) {
                return {
                    iban: null,
                    linkedAddress: null,
                    isLinkedToWallet: false,
                };
            }

            const targetIban =
                ibans.find((i) => i.state === "approved") ?? ibans[0];

            if (!targetIban) {
                return {
                    iban: null,
                    linkedAddress: null,
                    isLinkedToWallet: false,
                };
            }

            const ibanValue = targetIban.iban;
            const linkedAddress = targetIban.address ?? null;

            // Ethereum addresses require case-insensitive comparison (checksummed vs lowercase)
            const isLinkedToWallet =
                linkedAddress !== null &&
                walletAddress !== undefined &&
                linkedAddress.toLowerCase() === walletAddress.toLowerCase();

            if (ibanValue && linkedAddress) {
                moneriumStore.getState().setIban(ibanValue, linkedAddress);
            }

            return { iban: ibanValue, linkedAddress, isLinkedToWallet };
        },
        enabled: isEnabled,
        staleTime: FIVE_MINUTES_MS,
        refetchOnWindowFocus: true,
    });

    return {
        iban: query.data?.iban ?? null,
        isLinkedToWallet: query.data?.isLinkedToWallet ?? false,
        linkedAddress: query.data?.linkedAddress ?? null,
        isLoading: query.isLoading,
        error: query.error,
    };
}
