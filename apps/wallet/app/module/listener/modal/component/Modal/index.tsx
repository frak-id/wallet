import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Drawer, DrawerContent } from "@/module/common/component/Drawer";
import { InAppBrowserToast } from "@/module/common/component/InAppBrowserToast";
import {
    displayedRpcModalStepsAtom,
    modalRpcResultsAtom,
} from "@/module/listener/modal/atoms/modalEvents";
import {
    clearRpcModalAtom,
    currentDisplayedStepAtom,
    onFinishResultAtom,
} from "@/module/listener/modal/atoms/modalUtils";
import { SiweAuthenticateModalStep } from "@/module/listener/modal/component/Authenticate";
import { FinalModalStep } from "@/module/listener/modal/component/Final";
import { MetadataInfo } from "@/module/listener/modal/component/Generic";
import { LoginModalStep } from "@/module/listener/modal/component/Login";
import { OpenSessionModalStep } from "@/module/listener/modal/component/OpenSession";
import { TransactionModalStep } from "@/module/listener/modal/component/Transaction";
import {
    type GenericWalletUiType,
    type ModalUiType,
    useListenerTranslation,
    useListenerUI,
} from "@/module/listener/providers/ListenerUiProvider";
import { OriginPairingState } from "@/module/pairing/component/OriginPairingState";
import { RpcErrorCodes } from "@frak-labs/core-sdk";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { useMediaQuery } from "@frak-labs/ui/hook/useMediaQuery";
import { LogoFrakWithName } from "@frak-labs/ui/icons/LogoFrakWithName";
import { prefixModalCss } from "@frak-labs/ui/utils/prefixModalCss";
import { cx } from "class-variance-authority";
import { useAtomValue } from "jotai";
import {
    type Dispatch,
    type PropsWithChildren,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
} from "react";
import { Toaster } from "sonner";
import { ToastLoading } from "../../../component/ToastLoading";
import { ModalStepIndicator } from "./Step";
import styles from "./index.module.css";

/**
 * Display the given request in a modal
 */
export function ListenerModal({
    metadata,
    emitter,
    logoUrl,
}: ModalUiType & GenericWalletUiType) {
    const { clearRequest } = useListenerUI();

    /**
     * Method to close the modal
     */
    const onClose = useCallback(() => {
        clearRequest();
        jotaiStore.set(clearRpcModalAtom);
    }, [clearRequest]);

    /**
     * Method to close the modal
     */
    const onError = useCallback(
        (reason?: string, code: number = RpcErrorCodes.serverError) => {
            emitter({
                error: {
                    code,
                    message:
                        reason ??
                        "Error during the user interaction with the modal",
                },
            });
            onClose();
        },
        [onClose, emitter]
    );

    /**
     * Method when the user reached the end of the modal
     */
    const onFinishResult = useAtomValue(onFinishResultAtom);
    useEffect(() => {
        if (!onFinishResult) return;

        // Emit the result and exit
        emitter({
            result: onFinishResult,
        });
        onClose();
    }, [onFinishResult, emitter, onClose]);

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
            emitter({
                result: results,
            });
            onClose();
        },
        [emitter, onClose, onError]
    );

    /**
     * The inner component to display
     */
    const { titleComponent, icon, footer } = useMemo(() => {
        // Build the title component we will display
        const titleComponent = metadata?.header?.title ? (
            <>{metadata.header.title}</>
        ) : (
            <div />
        );

        // The provided by frak component
        const providedBy = (
            <span
                className={cx(
                    styles.modalTitle__provided,
                    prefixModalCss("provided")
                )}
            >
                provided by{" "}
                <LogoFrakWithName className={styles.modalTitle__logo} />
            </span>
        );

        // Build the header icon component (only if we got an icon)
        const icon = logoUrl ? (
            <div className={styles.modalListener__iconContainer}>
                <img
                    src={logoUrl}
                    alt={""}
                    className={styles.modalListener__icon}
                />
                {providedBy}
            </div>
        ) : null;

        // Build the footer (only if no icon present)
        const footer = logoUrl ? null : (
            <div className={styles.modalListener__footer}>
                <OriginPairingState type="modal" />
                {providedBy}
            </div>
        );

        return {
            titleComponent,
            footer,
            icon,
        };
    }, [metadata, logoUrl]);

    return (
        <ModalComponent
            title={titleComponent}
            open={true}
            onOpenChange={onOpenChange}
        >
            <Toaster position="top-center" />
            <InAppBrowserToast />
            <ToastLoading />
            <>
                {icon}
                <CurrentModalMetadataInfo />
                <ModalStepIndicator />
                <CurrentModalStepComponent onError={onError} />
                {footer}
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
    const { t, i18n } = useListenerTranslation();
    const modalSteps = useAtomValue(displayedRpcModalStepsAtom);

    // Extract step key and metadata
    const descriptionKey = useMemo(() => {
        const currentStep =
            modalSteps?.steps?.[modalSteps.currentStep] ?? undefined;
        if (!currentStep) return null;

        // If we are in the final step, and the modal was dismissed, used the dismissed metadata
        if (currentStep.key === "final" && modalSteps?.dismissed) {
            return `sdk.modal.${currentStep.key}.dismissed.description`;
        }

        // Otherwise, use the default description
        return `sdk.modal.${currentStep.key}.description`;
    }, [modalSteps]);

    // Get the right message depending on the step
    return useMemo(() => {
        if (!descriptionKey) return null;

        // Check if i18n contain the keys
        const hasDescription = i18n.exists(descriptionKey);

        // Return the matching component
        return (
            <MetadataInfo
                description={hasDescription ? t(descriptionKey) : undefined}
            />
        );
    }, [descriptionKey, i18n, t]);
}

/**
 * Return the right inner component depending on the current modal step
 * @constructor
 */
function CurrentModalStepComponent({
    onError,
}: {
    onError: (reason?: string) => void;
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
                        params={currentStep.params}
                        onFinish={currentStep.onResponse}
                    />
                );
            case "siweAuthenticate":
                return (
                    <SiweAuthenticateModalStep
                        params={currentStep.params}
                        onFinish={currentStep.onResponse}
                    />
                );
            case "sendTransaction":
                return (
                    <TransactionModalStep
                        params={currentStep.params}
                        onFinish={currentStep.onResponse}
                    />
                );
            case "openSession":
                return (
                    <OpenSessionModalStep
                        onFinish={currentStep.onResponse}
                        onError={onError}
                    />
                );
            case "final":
                return (
                    <FinalModalStep
                        params={currentStep.params}
                        onFinish={currentStep.onResponse}
                    />
                );
            default:
                return <>Can't handle {currentStep} yet</>;
        }
    }, [onError, currentStep]);
}
