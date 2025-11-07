import { RpcErrorCodes } from "@frak-labs/frame-connector";
import { useMediaQuery } from "@frak-labs/ui/hook/useMediaQuery";
import { LogoFrakWithName } from "@frak-labs/ui/icons/LogoFrakWithName";
import { prefixModalCss } from "@frak-labs/ui/utils/prefixModalCss";
import {
    Drawer,
    DrawerContent,
    InAppBrowserToast,
    OriginPairingState,
    WalletModal,
} from "@frak-labs/wallet-shared";
import { cx } from "class-variance-authority";
import {
    type Dispatch,
    type PropsWithChildren,
    type ReactNode,
    useCallback,
    useMemo,
    useState,
} from "react";
import { Toaster } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { SiweAuthenticateModalStep } from "@/module/modal/component/Authenticate";
import { FinalModalStep } from "@/module/modal/component/Final";
import { MetadataInfo } from "@/module/modal/component/Generic";
import { LoginModalStep } from "@/module/modal/component/Login";
import { OpenSessionModalStep } from "@/module/modal/component/OpenSession";
import { TransactionModalStep } from "@/module/modal/component/Transaction";
import {
    type GenericWalletUiType,
    type ModalUiType,
    useListenerTranslation,
    useListenerUI,
} from "@/module/providers/ListenerUiProvider";
import {
    modalStore,
    selectCurrentStep,
    selectCurrentStepObject,
    selectIsDismissed,
} from "@/module/stores/modalStore";
import { ToastLoading } from "../../../component/ToastLoading";
import styles from "./index.module.css";
import { ModalStepIndicator } from "./Step";

/**
 * Display the given request in a modal
 */
export function ListenerModal({
    metadata,
    emitter,
    logoUrl,
}: ModalUiType & GenericWalletUiType) {
    const { clearRequest } = useListenerUI();
    const [isOpen, setIsOpen] = useState(true);

    /**
     * Method to close the modal
     */
    const onClose = useCallback(() => {
        // First, trigger the modal close animation
        setIsOpen(false);

        // Wait for animation to complete before clearing state
        setTimeout(() => {
            // Clear modal store
            modalStore.getState().clearModal();
            // Then clear the UI request which will unmount the component
            clearRequest();
        }, 200); // 200ms for animation
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
     * When the modal visibility changes (user manually closes modal)
     * Note: This handles the edge case where user closes after completing all steps.
     * The hook subscription (useDisplayModalListener) handles normal completion flow.
     * This callback handles manual close and determines if it's a success or cancellation.
     */
    const onOpenChange = useCallback(
        (isVisible: boolean) => {
            if (isVisible) return;

            // Get the current results and steps from Zustand
            const state = modalStore.getState();
            const results = state.results;
            const steps = state.steps;

            // Get the expected results and the current results
            const expectedResults =
                steps?.filter((step) => step.key !== "final")?.length ?? 0;
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
            metadata.header.title
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
            open={isOpen}
            onOpenChange={onOpenChange}
        >
            <Toaster position="top-center" />
            <InAppBrowserToast />
            <ToastLoading />

            {icon}
            <CurrentModalMetadataInfo />
            <ModalStepIndicator />
            <CurrentModalStepComponent onError={onError} />
            {footer}
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

    // Use a Drawer for mobile and a WalletModal for desktop
    if (isDesktop) {
        return (
            <WalletModal
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
    // Consolidate subscriptions using useShallow for better performance
    const { currentStep, isDismissed } = modalStore(
        useShallow((state) => ({
            currentStep: selectCurrentStepObject(state),
            isDismissed: selectIsDismissed(state),
        }))
    );

    // Extract step key and metadata
    const descriptionKey = useMemo(() => {
        if (!currentStep) return null;

        // If we are in the final step, and the modal was dismissed, used the dismissed metadata
        if (currentStep.key === "final" && isDismissed) {
            return `sdk.modal.${currentStep.key}.dismissed.description`;
        }

        // Otherwise, use the default description
        return `sdk.modal.${currentStep.key}.description`;
    }, [currentStep, isDismissed]);

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
    const currentStep = modalStore(selectCurrentStep);

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
