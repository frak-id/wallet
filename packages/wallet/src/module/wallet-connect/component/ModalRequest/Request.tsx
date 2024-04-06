import type { WalletConnectRequestArgs } from "@/module/wallet-connect/component/EventsWalletConnect";
import { SignRequestModal } from "@/module/wallet-connect/component/ModalRequest/SignRequest";
import { SignTypedDataRequestModal } from "@/module/wallet-connect/component/ModalRequest/SignTypedDataRequest";
import { useMemo } from "react";

/**
 * Switch to pick the right modal for a request
 * @param args
 * @param onClose
 * @constructor
 */
export function RequestModal({
    args,
    onClose,
}: {
    args: Extract<WalletConnectRequestArgs, { type: "request" }>;
    onClose: () => void;
}) {
    // Extract the method from the request
    const method = useMemo(
        () => args.params.request.method,
        [args.params.request.method]
    );

    // TODO: We can have a few generics here (rejection and acceptance formatting, open / close state handling etc)
    // TODO: The only thing differing is the inner content, and the smart wallet action

    // TODO: Should check the chain and enforce it here? Or maybe enforce it inside the modal view?

    // If that's a signature request
    if (method === "eth_sign" || method === "personal_sign") {
        return <SignRequestModal args={args} onClose={onClose} />;
    }
    // If that's a typed data signature request
    if (
        method === "eth_signTypedData" ||
        method === "eth_signTypedData_v3" ||
        method === "eth_signTypedData_v4"
    ) {
        return <SignTypedDataRequestModal args={args} onClose={onClose} />;
    }

    console.error("Unknown request type", { method });
    return <>Unknown request type</>;
}
