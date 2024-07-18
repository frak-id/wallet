"use client";

import { iFrameToggleVisibility } from "@/context/sdk/utils/iFrameToggleVisibility";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { modalDisplayedRequestAtom } from "@/module/listener/atoms/modalEvents";
import { AuthModal } from "@/module/listener/component/Modal/AuthModal";
import { TransactionModal } from "@/module/listener/component/Modal/TransactionModal";
import type { ModalEventRequestArgs } from "@/module/listener/types/ModalEvent";
import {type ModalRpcRequest, RpcErrorCodes} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { useAtomValue } from "jotai/index";
import { useCallback, useEffect, useMemo } from "react";
import styles from "./index.module.css";

/**
 * Display the current wallet connect modal
 * @constructor
 */
export function ListenerModal() {
    /**
     * The current request that is being displayed
     */
    const currentRequest = useAtomValue(modalDisplayedRequestAtom);

    // If we don't have a modal, do nothing
    if (!currentRequest) return null;

    return <ListenerModalDialog currentRequest={currentRequest} />;
}

/**
 * Display the given request in a modal
 * @param currentRequest
 * @constructor
 */
function ListenerModalDialog({
    currentRequest,
}: { currentRequest: ModalRpcRequest }) {
    /**
     * Display the iframe
     */
    useEffect(() => {
        iFrameToggleVisibility(true);
    }, []);

    /**
     * Method to close the modal
     */
    const onClose = useCallback(() => {
        iFrameToggleVisibility(false);
        jotaiStore.set(modalDisplayedRequestAtom, undefined);
    }, []);

    /**
     * The inner component to display
     */
    const component = useMemo(() => {
        // Handle an auth modal
        if (currentRequest.type === "auth") {
            return {
                title: "Nexus Wallet",
                content: <AuthModal args={currentRequest} onHandle={onClose} />,
            };
        }

        // Handle a request modal
        if (currentRequest.type === "transaction") {
            return {
                title: "Transaction",
                content: (
                    <TransactionModal
                        args={currentRequest}
                        onHandle={onClose}
                    />
                ),
            };
        }

        return {
            title: "Error",
            content: <>Can't handle type {currentRequest} yet</>,
        };
    }, [currentRequest, onClose]);

    return (
        <AlertDialog
            classNameTitle={styles.modalListener__title}
            title={component.title}
            text={component.content}
            open={true}
            onOpenChange={(value) => {
                if (!value) {
                    // Emit the discarded event
                    currentRequest.emitter({
                        error: {
                            code: RpcErrorCodes.clientAborted,
                            message: "User cancelled the request",
                        },
                    });
                    onClose();
                }
            }}
        />
    );
}

export function HelpModal() {
    return (
        <p className={styles.modalListener__help}>
            Need help? Contact us at{" "}
            <a href="mailto:hello@frak.id">hello@frak.id</a>
        </p>
    );
}
