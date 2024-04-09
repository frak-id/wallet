"use client";

import {
    wcDisplayedRequestAtom,
    wcRemoveRequestAtom,
} from "@/module/wallet-connect/atoms/events";
import { WcModal } from "@/module/wallet-connect/component/ModalRequest/Components";
import { PairingModal } from "@/module/wallet-connect/component/ModalRequest/Pairing";
import { SignRequestModal } from "@/module/wallet-connect/component/ModalRequest/SignRequest";
import { SignTypedDataRequestModal } from "@/module/wallet-connect/component/ModalRequest/SignTypedDataRequest";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/types/event";
import { useAtomValue, useSetAtom } from "jotai/index";
import { useCallback, useMemo, useState } from "react";

/**
 * Display the current wallet connect modal
 * @constructor
 */
export function WalletConnectModal() {
    /**
     * The current request that is being displayed
     */
    const currentRequest = useAtomValue(wcDisplayedRequestAtom);

    // If we don't have a modal, do nothing
    if (!currentRequest) return null;

    return <WcModalDialog currentRequest={currentRequest} />;
}

/**
 * Display the given request in a modal
 * @param currentRequest
 * @constructor
 */
function WcModalDialog({
    currentRequest,
}: { currentRequest: WalletConnectRequestArgs }) {
    /**
     * Handle the request list
     */
    const removeRequest = useSetAtom(wcRemoveRequestAtom);

    /**
     * The current request that is being displayed
     */
    const setCurrentRequest = useSetAtom(wcDisplayedRequestAtom);

    /**
     * Display state of the modal
     */
    const [isOpen, setIsOpen] = useState(true);

    /**
     * Method to close the modal
     */
    const onClose = useCallback(() => {
        setIsOpen(false);
        setCurrentRequest(undefined);
    }, [setCurrentRequest]);

    /**
     * Action when a modal is closed
     */
    const onHandle = useCallback(() => {
        removeRequest(currentRequest.id);
        onClose();
    }, [currentRequest, removeRequest, onClose]);

    /**
     * The inner component to display
     */
    const component = useMemo(() => {
        // Handle a pairing modal
        if (currentRequest.type === "pairing") {
            return <PairingModal args={currentRequest} onHandle={onHandle} />;
        }

        // Handle a request modal
        if (currentRequest.type === "request") {
            return <RequestModal args={currentRequest} onHandle={onHandle} />;
        }

        // TODO: Also handle auth modal (with SIWE)

        return <>Can't handle type {currentRequest} yet</>;
    }, [currentRequest, onHandle]);

    return (
        <WcModal
            open={isOpen}
            onOpenChange={(value) => {
                if (value === false) {
                    onClose();
                }
            }}
            children={component}
        />
    );
}

/**
 * Switch to pick the right modal for a request
 * @param args
 * @param onClose
 * @constructor
 */
function RequestModal({
    args,
    onHandle,
}: {
    args: Extract<WalletConnectRequestArgs, { type: "request" }>;
    onHandle: () => void;
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
        return <SignRequestModal args={args} onHandle={onHandle} />;
    }
    // If that's a typed data signature request
    if (
        method === "eth_signTypedData" ||
        method === "eth_signTypedData_v3" ||
        method === "eth_signTypedData_v4"
    ) {
        return <SignTypedDataRequestModal args={args} onHandle={onHandle} />;
    }

    console.error("Unknown request type", { method });
    return <>Unknown request type</>;
}
