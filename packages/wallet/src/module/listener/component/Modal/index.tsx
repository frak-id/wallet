"use client";
import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Drawer, DrawerContent } from "@/module/common/component/Drawer";
import {
    type ModalDisplayedRequest,
    clearRpcModalAtom,
    modalDisplayedRequestAtom,
    modalStepsAtom,
} from "@/module/listener/atoms/modalEvents";
import { SiweAuthenticateModalStep } from "@/module/listener/component/Authenticate";
import { LoginModalStep } from "@/module/listener/component/Login";
import { ModalStepIndicator } from "@/module/listener/component/Modal/Step";
import { OpenSessionModalStep } from "@/module/listener/component/OpenSession";
import { SuccessModalStep } from "@/module/listener/component/Success";
import { TransactionModalStep } from "@/module/listener/component/Transaction";
import {
    type LoginModalStepType,
    type ModalRpcStepsResultType,
    type ModalStepTypes,
    type OpenInteractionSessionModalStepType,
    RpcErrorCodes,
    type SendTransactionModalStepType,
    type SiweAuthenticateModalStepType,
    type SuccessModalStepType,
} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { useMediaQuery } from "@module/hook/useMediaQuery";
import { useAtomValue } from "jotai";
import {
    type Dispatch,
    type PropsWithChildren,
    useCallback,
    useEffect,
    useMemo,
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
}: { currentRequest: ModalDisplayedRequest }) {
    /**
     * Display the iframe
     */
    useEffect(() => {
        emitLifecycleEvent({
            iframeLifecycle: "show",
        });
    }, []);

    /**
     * Method to close the modal
     */
    const onClose = useCallback(() => {
        emitLifecycleEvent({
            iframeLifecycle: "hide",
        });
        jotaiStore.set(clearRpcModalAtom);
    }, []);

    /**
     * Method to close the modal
     */
    const onError = useCallback(
        (reason?: string, code: number = RpcErrorCodes.serverError) => {
            currentRequest.emitter({
                error: {
                    code,
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
     * Method when the user reached the end of the modal
     */
    const onFinished = useCallback(() => {
        const results = jotaiStore.get(modalStepsAtom)?.results;
        if (!results) {
            onError("No result following the modal", RpcErrorCodes.serverError);
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
    }, [onClose, onError, currentRequest]);

    /**
     * When the modal visibility changes
     */
    const onOpenChange = useCallback(
        (isVisible: boolean) => {
            if (isVisible) return;

            // Get the current results
            const steps = jotaiStore.get(modalStepsAtom);
            const results = steps?.results;

            // Get the expected results and the current results
            const expectedResults =
                steps?.steps?.filter((step) => step.key !== "success")
                    ?.length ?? 0;
            const resultsLength = steps?.results?.length ?? 0;

            // If we don't have enough results, we can tell the requester that the modal was cancelled
            if (!results || expectedResults !== resultsLength) {
                onError(
                    "User cancelled the request",
                    RpcErrorCodes.clientAborted
                );
                return;
            }

            // Otherwise, we can tell the requester that the modal was cancelled
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
        },
        [currentRequest, onClose, onError]
    );

    /**
     * The inner component to display
     */
    const { title, icon } = useMemo(() => {
        return {
            title: currentRequest.metadata?.header?.title,
            icon: currentRequest?.metadata?.header?.icon,
        };
    }, [
        currentRequest?.metadata?.header?.title,
        currentRequest?.metadata?.header?.icon,
    ]);

    return (
        <ModalComponent title={title} open={true} onOpenChange={onOpenChange}>
            <>
                {icon && (
                    <img
                        src={icon}
                        alt={""}
                        className={styles.modalListener__icon}
                    />
                )}
                <ModalStepIndicator />
                <CurrentModalStepComponent
                    currentRequest={currentRequest}
                    onModalFinish={onFinished}
                    onError={onError}
                />
            </>
        </ModalComponent>
    );
}

/**
 * Main component for the modal (either drawer or alert bx depending on the client)
 * @param title
 * @param open
 * @param onOpenChange
 * @param children
 * @constructor
 */
function ModalComponent({
    title,
    open,
    onOpenChange,
    children,
}: PropsWithChildren<{
    title?: string;
    open: boolean;
    onOpenChange: Dispatch<boolean>;
}>) {
    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    if (isDesktop) {
        return (
            <AlertDialog
                classNameTitle={styles.modalListener__title}
                title={title}
                text={children}
                open={open}
                onOpenChange={onOpenChange}
            />
        );
    }

    // Otherwise, return bottom drawer
    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>{children}</DrawerContent>
        </Drawer>
    );
}

/**
 * Return the right inner component depending on the current modal step
 * @constructor
 */
function CurrentModalStepComponent({
    onModalFinish,
    onError,
    currentRequest,
}: {
    onModalFinish: () => void;
    onError: (reason?: string) => void;
    currentRequest: ModalDisplayedRequest;
}) {
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
                return;
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
                        appName={currentRequest.appName}
                        context={currentRequest.context}
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
            case "openSession":
                return (
                    <OpenSessionModalStep
                        params={
                            currentStep.params as OpenInteractionSessionModalStepType["params"]
                        }
                        onFinish={onStepFinished}
                        onError={onError}
                    />
                );
            case "success":
                return (
                    <SuccessModalStep
                        appName={currentRequest.appName}
                        params={
                            currentStep.params as SuccessModalStepType["params"]
                        }
                        onFinish={onStepFinished}
                    />
                );
            default:
                return <>Can't handle {currentStep} yet</>;
        }
    }, [
        currentStep,
        onStepFinished,
        onError,
        currentRequest.context,
        currentRequest.appName,
    ]);
}
