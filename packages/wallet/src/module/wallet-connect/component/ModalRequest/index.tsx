"use client";

import {
    wcDisplayedRequestAtom,
    wcRemoveRequestAtom,
} from "@/module/wallet-connect/atoms/events";
import { PairingModal } from "@/module/wallet-connect/component/ModalRequest/Pairing";
import { SignRequestModal } from "@/module/wallet-connect/component/ModalRequest/SignRequest";
import { SignTypedDataRequestModal } from "@/module/wallet-connect/component/ModalRequest/SignTypedDataRequest";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/types/event";
import { useAtomValue, useSetAtom } from "jotai/index";
import { useCallback, useMemo } from "react";

/**
 * Display the current wallet connect modal
 * @constructor
 */
export function WalletConnectModal() {
    /**
     * Handle the request list
     */
    const removeRequest = useSetAtom(wcRemoveRequestAtom);

    /**
     * The current request that is being displayed
     */
    const currentRequest = useAtomValue(wcDisplayedRequestAtom);

    /**
     * Action when a modal is closed
     */
    const onModalClose = useCallback(() => {
        // Get the current request
        const request = currentRequest;
        // Remove the request from the list
        if (!request) return;
        removeRequest(request.id);
    }, [currentRequest, removeRequest]);

    // If we don't have a modal, do nothing
    if (!currentRequest) return null;

    // Handle a pairing modal
    if (currentRequest.type === "pairing") {
        return <PairingModal args={currentRequest} onClose={onModalClose} />;
    }

    // Handle a request modal
    if (currentRequest.type === "request") {
        return <RequestModal args={currentRequest} onClose={onModalClose} />;
    }

    // TODO: Also handle auth modal (with SIWE)

    return <> </>;
}

/**
 * Switch to pick the right modal for a request
 * @param args
 * @param onClose
 * @constructor
 */
function RequestModal({
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
