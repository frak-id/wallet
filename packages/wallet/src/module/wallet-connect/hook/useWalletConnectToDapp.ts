import { isValidConnectionUri } from "@/context/wallet-connect/pairing";
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

            // Ensure it's a valid connection URI
            if (!isValidConnectionUri(connectionUri)) {
                throw new Error("Invalid WalletConnect URI");
            }

            // Launch the pairing process
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
