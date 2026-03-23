import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { getIbans } from "@/module/monerium/utils/moneriumApi";
import { useMoneriumProfile } from "./useMoneriumProfile";

type IbanQueryResult = {
    iban: string | null;
    linkedAddress: string | null;
    isLinkedToWallet: boolean;
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useMoneriumIban() {
    const { address: walletAddress } = useAccount();
    const { profileId, profileState } = useMoneriumProfile();

    const isEnabled = profileState === "approved" && !!profileId;

    const query = useQuery({
        queryKey: moneriumKey.iban(profileId),
        queryFn: async (): Promise<IbanQueryResult> => {
            const { ibans } = await getIbans();

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

            const isLinkedToWallet =
                linkedAddress !== null &&
                walletAddress !== undefined &&
                linkedAddress.toLowerCase() === walletAddress.toLowerCase();

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
