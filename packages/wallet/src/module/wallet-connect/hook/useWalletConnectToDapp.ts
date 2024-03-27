import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useMutation } from "@tanstack/react-query";

export function useWalletConnectToDapp({
    connectionUri,
}: { connectionUri: string }) {
    const { walletConnectInstance } = useWalletConnect();

    const {
        mutate: onConnect,
        status,
        error,
    } = useMutation({
        mutationKey: ["wallet-connect-pairing", connectionUri],
        mutationFn: async () => {
            if (!(connectionUri && walletConnectInstance)) return true;

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
