import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useMutation } from "@tanstack/react-query";

export function useWalletConnectToDapp() {
    const { walletConnectInstance } = useWalletConnect();

    const {
        mutateAsync: onConnect,
        status,
        error,
    } = useMutation({
        mutationKey: ["wallet-connect-pairing"],
        mutationFn: async (connectionUri: string) => {
            if (!(connectionUri && walletConnectInstance)) return;

            await walletConnectInstance.pair({
                uri: connectionUri,
            });
        },
    });

    return {
        onConnect,
        status,
        error,
    };
}
