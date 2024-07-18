"use client";

import { iFrameToggleVisibility } from "@/context/sdk/utils/iFrameToggleVisibility";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import {
    type ModalDisplayedRequest,
    clearRpcModalAtom,
    modalDisplayedRequestAtom,
    modalStepsAtom,
} from "@/module/listener/atoms/modalEvents";
import { SiweAuthenticateModalStep } from "@/module/listener/component/Authenticate";
import { LoginModalStep } from "@/module/listener/component/Login";
import { ModalStepIndicator } from "@/module/listener/component/Modal/Step";
import { TransactionModalStep } from "@/module/listener/component/Transaction";
import {
    type LoginModalStepType,
    type ModalRpcStepsResultType,
    type ModalStepTypes,
    RpcErrorCodes,
    type SendTransactionModalStepType,
    type SiweAuthenticateModalStepType,
} from "@frak-labs/nexus-sdk/core";
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
}: { currentRequest: ModalDisplayedRequest }) {
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
        jotaiStore.set(clearRpcModalAtom);
    }, []);

    /**
     * Method when the user reached the end of the modal
     */
    const onFinished = useCallback(() => {
        const results = jotaiStore.get(modalStepsAtom)?.results;
        if (!results) {
            currentRequest.emitter({
                error: {
                    code: RpcErrorCodes.serverError,
                    message: "No result following the modal",
                },
            });
            onClose();
            return;
        }

        // Format the results from [{key, returns}] to {key: returns}
        const formattedResults = results.reduce(
            (acc, { key, returns }) => {
                acc[key] = returns;
                return acc;
            },
            {} as Record<string, unknown>
        ) as ModalRpcStepsResultType;

        currentRequest.emitter({
            result: formattedResults,
        });
        onClose();
    }, [onClose, currentRequest]);

    /**
     * Method to close the modal
     */
    const onError = useCallback(
        (reason?: string) => {
            currentRequest.emitter({
                error: {
                    code: RpcErrorCodes.serverError,
                    message:
                        reason ??
                        "Error during the user interaction with the modal",
                },
            });
            onClose();
        },
        [onClose, currentRequest]
    );

    /**
     * The inner component to display
     */
    const { title } = useMemo(() => {
        // todo: How to get the title? Depending on the latest step of this modal request? Provided as context?
        return { title: "Title" };
    }, []);

    return (
        <AlertDialog
            classNameTitle={styles.modalListener__title}
            title={title}
            text={
                <>
                    <ModalStepIndicator />
                    <CurrentModalStepComponent
                        onModalFinish={onFinished}
                        onError={onError}
                    />
                </>
            }
            open={true}
            onOpenChange={(value) => {
                if (!value) {
                    // todo: Should include in the error the partial results?? (if any)
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

/**
 * Return the right inner component depending on the current modal step
 * @constructor
 */
function CurrentModalStepComponent({
    onModalFinish,
    onError,
}: { onModalFinish: () => void; onError: (reason?: string) => void }) {
    const modalSteps = useAtomValue(modalStepsAtom);
    const currentStep = useMemo(
        () => modalSteps?.steps?.[modalSteps.currentStep] ?? undefined,
        [modalSteps]
    );

    /**
     * Action when the step is finished
     */
    const onStepFinished = useCallback(
        (result: ModalStepTypes["returns"]) => {
            if (!modalSteps) {
                onModalFinish();
                return;
            }

            const currentStepIndex = modalSteps.currentStep;

            // Our new result array
            const newResults = modalSteps.results;
            newResults[currentStepIndex] = {
                key: modalSteps.steps[currentStepIndex].key,
                returns: result,
            };

            // Otherwise, we move to the next step
            jotaiStore.set(modalStepsAtom, (current) => {
                if (!current) return null;
                return {
                    ...current,
                    currentStep: current.currentStep + 1,
                    results: newResults,
                };
            });

            // If we reached the end of the steps, we close the modal
            if (modalSteps.currentStep + 1 >= modalSteps.steps.length) {
                onModalFinish();
            }
        },
        [onModalFinish, modalSteps]
    );

    /**
     * Return the right modal depending on the state
     */
    return useMemo(() => {
        if (!currentStep) return null;

        // Display the right component depending on the step
        switch (currentStep.key) {
            case "login":
                return (
                    <LoginModalStep
                        params={
                            currentStep.params as LoginModalStepType["params"]
                        }
                        onFinish={onStepFinished}
                        onError={onError}
                    />
                );
            case "siweAuthenticate":
                return (
                    <SiweAuthenticateModalStep
                        params={
                            currentStep.params as SiweAuthenticateModalStepType["params"]
                        }
                        onFinish={onStepFinished}
                        onError={onError}
                    />
                );
            case "sendTransaction":
                return (
                    <TransactionModalStep
                        params={
                            currentStep.params as SendTransactionModalStepType["params"]
                        }
                        onFinish={onStepFinished}
                        onError={onError}
                    />
                );
            default:
                return <>Can't handle {currentStep} yet</>;
        }
    }, [currentStep, onStepFinished, onError]);
}

/**
 * Generic helper modal
 * @constructor
 */
export function HelpModal() {
    return (
        <p className={styles.modalListener__help}>
            Need help? Contact us at{" "}
            <a href="mailto:hello@frak.id">hello@frak.id</a>
        </p>
    );
}
