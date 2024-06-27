"use client";

import { iFrameToggleVisibility } from "@/context/sdk/utils/iFrameToggleVisibility";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { modalDisplayedRequestAtom } from "@/module/listener/atoms/modalEvents";
import { AuthModal } from "@/module/listener/component/Modal/AuthModal";
import { TransactionModal } from "@/module/listener/component/Modal/TransactionModal";
import type { modalEventRequestArgs } from "@/module/listener/types/modalEvent";
import { useAtomValue, useSetAtom } from "jotai/index";
import {
    type PropsWithChildren,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
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
}: { currentRequest: modalEventRequestArgs }) {
    /**
     * The current request that is being displayed
     */
    const setCurrentRequest = useSetAtom(modalDisplayedRequestAtom);

    /**
     * Display state of the modal
     */
    const [isOpen, setIsOpen] = useState(true);

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
        setIsOpen(false);
        iFrameToggleVisibility(false);
        setCurrentRequest(undefined);

        // Send the aborted event
        currentRequest.listener.emitter({
            key: "aborted",
        });
    }, [setCurrentRequest, currentRequest.listener.emitter]);

    /**
     * Action when a modal is closed
     */
    const onHandle = useCallback(() => {
        onClose();
    }, [onClose]);

    /**
     * The inner component to display
     */
    const component = useMemo(() => {
        // Handle an auth modal
        if (currentRequest.type === "auth") {
            return <AuthModal args={currentRequest} onHandle={onHandle} />;
        }

        // Handle a request modal
        if (currentRequest.type === "transaction") {
            return (
                <TransactionModal args={currentRequest} onHandle={onHandle} />
            );
        }

        return <>Can't handle type {currentRequest} yet</>;
    }, [currentRequest, onHandle]);

    return (
        <AlertDialog
            text={component}
            open={isOpen}
            onOpenChange={(value) => {
                if (!value) {
                    onClose();
                }
            }}
        />
    );
}

/**
 * Header for a listener modal
 * @constructor
 */
export function ListenerModalHeader({
    title,
    children,
}: PropsWithChildren<{
    title: string;
}>) {
    return (
        <header className={styles.modalListener__header}>
            <h1 className={styles.modalListener__title}>{title}</h1>
            {children}
        </header>
    );
}
