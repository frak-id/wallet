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

            console.log("Wallet connect pairing with uri", {
                connectionUri,
            });

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
