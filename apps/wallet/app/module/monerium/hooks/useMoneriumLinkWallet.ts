import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isSmartAccountDeployed } from "permissionless";
import {
    useAccount,
    useClient,
    useSendTransaction,
    useSignMessage,
} from "wagmi";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { getProfiles, linkAddress } from "@/module/monerium/utils/moneriumApi";
import {
    ADDRESS_LINKING_MESSAGE,
    moneriumConfig,
} from "@/module/monerium/utils/moneriumConfig";

export function useMoneriumLinkWallet() {
    const { address } = useAccount();
    const client = useClient();
    const { signMessageAsync } = useSignMessage();
    const { sendTransactionAsync } = useSendTransaction();
    const queryClient = useQueryClient();

    const { mutate, mutateAsync, ...mutationRest } = useMutation({
        mutationFn: async () => {
            if (!address) throw new Error("No wallet connected");
            if (!client) throw new Error("No client available");

            const profiles = await getProfiles();
            if (!profiles?.profiles.length) {
                throw new Error("No profile detected");
            }

            const deployed = await isSmartAccountDeployed(client, address);
            if (!deployed) {
                await sendTransactionAsync({
                    to: address,
                    value: 0n,
                });
            }

            const signature = await signMessageAsync({
                message: ADDRESS_LINKING_MESSAGE,
            });

            return await linkAddress({
                profile: profiles.profiles[0].id,
                address,
                signature,
                message: ADDRESS_LINKING_MESSAGE,
                chain: moneriumConfig.chain,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: moneriumKey.all,
            });
        },
    });

    return {
        linkWallet: mutate,
        linkWalletAsync: mutateAsync,
        ...mutationRest,
    };
}
