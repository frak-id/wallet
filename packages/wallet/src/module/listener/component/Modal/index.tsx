"use client";
import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Drawer, DrawerContent } from "@/module/common/component/Drawer";
import {
    type ModalDisplayedRequest,
    displayedRpcModalStepsAtom,
    modalDisplayedRequestAtom,
    modalRpcResultsAtom,
} from "@/module/listener/atoms/modalEvents";
import {
    clearRpcModalAtom,
    currentDisplayedStepAtom,
    onFinishResultAtom,
} from "@/module/listener/atoms/modalUtils";
import { SiweAuthenticateModalStep } from "@/module/listener/component/Authenticate";
import { FinalModalStep } from "@/module/listener/component/Final";
import { LoginModalStep } from "@/module/listener/component/Login";
import { OpenSessionModalStep } from "@/module/listener/component/OpenSession";
import { TransactionModalStep } from "@/module/listener/component/Transaction";
import { RpcErrorCodes } from "@frak-labs/nexus-sdk/core";
import { LogoFrak } from "@module/asset/icons/LogoFrak";
import { jotaiStore } from "@module/atoms/store";
import { useMediaQuery } from "@module/hook/useMediaQuery";
import { useAtomValue } from "jotai";
import {
    type Dispatch,
    type PropsWithChildren,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { MetadataInfo } from "../Generic";
import { ModalStepIndicator } from "./Step";
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
        emitLifecycleEvent({ iframeLifecycle: "show" });
    }, []);

    /**
     * Method to close the modal
     */
    const onClose = useCallback(() => {
        emitLifecycleEvent({ iframeLifecycle: "hide" });
        jotaiStore.set(clearRpcModalAtom);
    }, []);

    /**
     * Set the language of the modal
     */
    const { i18n } = useTranslation();
    useEffect(() => {
        const lang = currentRequest?.metadata?.lang;
        if (lang && i18n.language !== lang) {
            i18n.changeLanguage(lang);
        }
    }, [currentRequest?.metadata?.lang, i18n]);

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
    const onFinishResult = useAtomValue(onFinishResultAtom);
    useEffect(() => {
        if (!onFinishResult) return;

        // Emit the result and exit
        currentRequest.emitter({
            result: onFinishResult,
        });
        onClose();
    }, [onFinishResult, currentRequest.emitter, onClose]);

    /**
     * When the modal visibility changes
     */
    const onOpenChange = useCallback(
        (isVisible: boolean) => {
            if (isVisible) return;

            // Get the current results
            const results = jotaiStore.get(modalRpcResultsAtom);
            const steps = jotaiStore.get(displayedRpcModalStepsAtom);

            // Get the expected results and the current results
            const expectedResults =
                steps?.steps?.filter((step) => step.key !== "final")?.length ??
                0;
            const resultsLength = Object.keys(results ?? {}).length;

            // If we don't have enough results, we can tell the requester that the modal was cancelled
            // In the case that the modal was dismissed, the result array won't contain all the value so we are good
            if (!results || expectedResults !== resultsLength) {
                onError(
                    "User cancelled the request",
                    RpcErrorCodes.clientAborted
                );
                return;
            }

            // If every steps completed, return the result
            currentRequest.emitter({
                result: results,
            });
            onClose();
        },
        [currentRequest, onClose, onError]
    );

    /**
     * The inner component to display
     */
    const { titleComponent, icon, context } = useMemo(() => {
        // Build the title component we will display
        const titleComponent = currentRequest.metadata?.header?.title ? (
            <>{currentRequest.metadata.header.title}</>
        ) : (
            <>
                Frak <LogoFrak sizes={14} className={styles.modalTitle__logo} />
            </>
        );

        return {
            titleComponent,
            context: currentRequest?.metadata?.context,
            icon: currentRequest?.metadata?.header?.icon,
        };
    }, [currentRequest?.metadata]);

    return (
        <ModalComponent
            title={titleComponent}
            open={true}
            onOpenChange={onOpenChange}
        >
            <>
                {icon && (
                    <img
                        src={icon}
                        alt={""}
                        className={styles.modalListener__icon}
                    />
                )}
                {context && (
                    <div className={styles.modalListener__context}>
                        {context}
                    </div>
                )}
                <CurrentModalMetadataInfo />
                <ModalStepIndicator />
                <CurrentModalStepComponent
                    currentRequest={currentRequest}
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
    title?: ReactNode;
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
            <DrawerContent>
                <div className={styles.drawerTitle__container}>{title}</div>
                {children}
            </DrawerContent>
        </Drawer>
    );
}

/**
 * Get the current modal metadata info component
 */
function CurrentModalMetadataInfo() {
    const { t, i18n } = useTranslation();
    const modalSteps = useAtomValue(displayedRpcModalStepsAtom);

    // Extract step key and metadata
    const { stepKey, metadata } = useMemo(() => {
        const currentStep =
            modalSteps?.steps?.[modalSteps.currentStep] ?? undefined;

        if (!currentStep) return { stepKey: undefined, metadata: undefined };

        // If we are in the final step, and the modal was dismissed, used the dismissed metadata
        let metadata = currentStep.params.metadata;
        if (currentStep.key === "final" && modalSteps?.dismissed) {
            metadata =
                currentStep.params.dismissedMetadata ??
                currentStep.params.metadata;
        }

        return {
            stepKey: currentStep.key,
            metadata,
        };
    }, [modalSteps]);

    // Get the right message depending on the step
    return useMemo(() => {
        if (!stepKey) return null;

        // Check if i18n contain the keys
        const defaultDescriptionKey = `sdk.modal.${stepKey}.default.description`;
        const hasDescription = i18n.exists(defaultDescriptionKey);

        // Return the matching component
        return (
            <MetadataInfo
                metadata={metadata}
                defaultDescription={
                    hasDescription ? t(defaultDescriptionKey) : undefined
                }
            />
        );
    }, [stepKey, metadata, i18n, t]);
}

/**
 * Return the right inner component depending on the current modal step
 * @constructor
 */
function CurrentModalStepComponent({
    onError,
    currentRequest,
}: {
    onError: (reason?: string) => void;
    currentRequest: ModalDisplayedRequest;
}) {
    const currentStep = useAtomValue(currentDisplayedStepAtom);

    /**
     * Return the right modal depending on the state
     */
    return useMemo(() => {
        // Extract some info about the current modal step
        if (!currentStep) return null;

        // Display the right component depending on the step
        switch (currentStep.key) {
            case "login":
                return (
                    <LoginModalStep
                        appName={currentRequest.appName}
                        context={currentRequest.context}
                        params={currentStep.params}
                        onFinish={currentStep.onResponse}
                        onError={onError}
                    />
                );
            case "siweAuthenticate":
                return (
                    <SiweAuthenticateModalStep
                        params={currentStep.params}
                        onFinish={currentStep.onResponse}
                        onError={onError}
                    />
                );
            case "sendTransaction":
                return (
                    <TransactionModalStep
                        params={currentStep.params}
                        onFinish={currentStep.onResponse}
                        onError={onError}
                    />
                );
            case "openSession":
                return (
                    <OpenSessionModalStep
                        params={currentStep.params}
                        onFinish={currentStep.onResponse}
                        onError={onError}
                    />
                );
            case "final":
                return (
                    <FinalModalStep
                        appName={currentRequest.appName}
                        params={currentStep.params}
                        onFinish={currentStep.onResponse}
                    />
                );
            default:
                return <>Can't handle {currentStep} yet</>;
        }
    }, [onError, currentRequest.context, currentRequest.appName, currentStep]);
}
