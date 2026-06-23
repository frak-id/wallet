import { BannerStack } from "@frak-labs/design-system/components/BannerStack";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon, LogoFrak } from "@frak-labs/design-system/icons";
import { RpcErrorCodes } from "@frak-labs/frame-connector";
import { WebauthnErrorToast } from "@frak-labs/wallet-shared/authentication";
import {
    InAppBrowserToast,
    Markdown,
    prefixModalCss,
    trackEvent,
} from "@frak-labs/wallet-shared/common";
import {
    getOriginPairingClient,
    OriginPairingState,
    useCancelAllSignatureRequests,
} from "@frak-labs/wallet-shared/pairing";
import { usePersistentPairingClient } from "@frak-labs/wallet-shared/pairing/usePersistentPairingClient";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import {
    type Dispatch,
    type PropsWithChildren,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useGetMergeToken } from "@/module/hooks/useGetMergeToken";
import { SiweAuthenticateModalStep } from "@/module/modal/component/Authenticate";
import { FinalModalStep } from "@/module/modal/component/Final";
import { LoginModalStep } from "@/module/modal/component/Login";
import { TransactionModalStep } from "@/module/modal/component/Transaction";
import {
    modalStore,
    selectCurrentStep,
    selectCurrentStepObject,
    selectIsDismissed,
    selectShouldFinish,
} from "@/module/stores/modalStore";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import { BlockchainProvider } from "@/ui/BlockchainProvider";
import {
    type GenericWalletUiType,
    type ModalUiType,
    useListenerTranslation,
    useListenerUI,
} from "@/ui/ListenerUiProvider";
import { ToastLoading } from "../../../component/ToastLoading";
import * as styles from "./index.css";

// Re-export the lazy handler body so it lands in the Modal default chunk
// instead of its own .impl shim chunk. See useDisplayModalListener.ts.
export { handleDisplayModal } from "@/module/hooks/useDisplayModalListener.impl";

/**
 * Display the given request in a modal
 */
export function ListenerModal(props: ModalUiType & GenericWalletUiType) {
    return (
        <BlockchainProvider>
            <ListenerModalInner {...props} />
        </BlockchainProvider>
    );
}

function ListenerModalInner({
    metadata,
    emitter,
    logoUrl,
}: ModalUiType & GenericWalletUiType) {
    const { clearRequest } = useListenerUI();
    // Pairing reconnect lives inside the lazy modal tree so the WebSocket
    // only opens when a partner site actually requests UI — keeping idle
    // iframes off the backend pairing socket.
    usePersistentPairingClient();
    const [isOpen, setIsOpen] = useState(true);
    const [logoFailed, setLogoFailed] = useState(false);
    const getMergeToken = useGetMergeToken();
    const parentUrl = useStore(
        resolvingContextStore,
        (s) => s.context?.sourceUrl
    );
    const cancelAllSignatures = useCancelAllSignatureRequests({
        client: getOriginPairingClient(),
    });

    useEffect(() => {
        setLogoFailed(false);
    }, [logoUrl]);
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
     * Method to close the modal on error.
     *
     * Emits `modal_step_error` for genuine errors; `clientAborted` is a
     * user-initiated dismiss and is tracked via `modal_dismissed` elsewhere.
     */
    const onError = useCallback(
        (reason?: string, code: number = RpcErrorCodes.serverError) => {
            if (code === RpcErrorCodes.clientAborted) {
                // User dismissed mid-flow — settle any in-flight signature on
                // the origin pairing client so the target wallet's prompt
                // clears immediately instead of waiting for the server's TTL.
                cancelAllSignatures("modal dismissed");
            } else {
                const state = modalStore.getState();
                const step = state.steps?.[state.currentStep]?.key ?? "unknown";
                trackEvent("modal_step_error", {
                    step,
                    reason: reason ?? "unknown",
                    recoverable: false,
                });
            }
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
        [onClose, emitter, cancelAllSignatures]
    );

    /**
     * Method when the user reached the end of the modal
     */
    const onFinishResult = modalStore(selectShouldFinish);
    useEffect(() => {
        if (!onFinishResult) return;

        // Emit the result and exit
        emitter({
            result: onFinishResult,
        });
        onClose();
    }, [onFinishResult, emitter, onClose]);

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
    const titleComponent = metadata?.header?.title ?? "";

    return (
        <ModalComponent open={isOpen} onOpenChange={onOpenChange}>
            <InAppBrowserToast
                getMergeToken={getMergeToken}
                parentUrl={parentUrl}
            />
            <ToastLoading />

            <BannerStack>
                <WebauthnErrorToast />
            </BannerStack>

            <Stack space="l" className={prefixModalCss("content-stack")}>
                <ModalHeader
                    title={titleComponent}
                    logoUrl={logoUrl}
                    logoFailed={logoFailed}
                    onLogoError={() => setLogoFailed(true)}
                />
                <CurrentModalStepComponent />
                <OriginPairingState type="modal" />
            </Stack>
        </ModalComponent>
    );
}

/**
 * Main component for the modal — alert dialog wrapper
 * @param title
 * @param open
 * @param onOpenChange
 * @param children
 * @constructor
 */
function ModalComponent({
    open,
    onOpenChange,
    children,
}: PropsWithChildren<{
    open: boolean;
    onOpenChange: Dispatch<boolean>;
}>) {
    return (
        <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <AlertDialogPrimitive.Portal>
                <AlertDialogPrimitive.Overlay
                    onClick={() => onOpenChange?.(false)}
                    className={`${prefixModalCss("overlay")} ${styles.alertDialog__overlay}`}
                />
                <AlertDialogPrimitive.Content
                    onEscapeKeyDown={() => onOpenChange?.(false)}
                    className={`${prefixModalCss("content")} ${styles.alertDialog__content}`}
                >
                    {children}
                </AlertDialogPrimitive.Content>
            </AlertDialogPrimitive.Portal>
        </AlertDialogPrimitive.Root>
    );
}

/**
 * Figma modal header — centered logo → title → subtitle.
 * Wraps the Radix Title/Description nodes (required for a11y) in DS Text.
 */
function ModalHeader({
    title,
    logoUrl,
    logoFailed,
    onLogoError,
}: {
    title: ReactNode;
    logoUrl?: string;
    logoFailed: boolean;
    onLogoError: () => void;
}) {
    return (
        <Stack space="none" className={prefixModalCss("header")}>
            <Inline space="none" align="right">
                <AlertDialogPrimitive.Cancel asChild>
                    <button
                        type="button"
                        className={`${prefixModalCss("close")} ${styles.alertDialog__close}`}
                        aria-label="Close"
                    >
                        <CloseIcon />
                    </button>
                </AlertDialogPrimitive.Cancel>
            </Inline>
            <Stack space="m" align="center">
                {logoUrl && !logoFailed ? (
                    <img
                        src={logoUrl}
                        alt=""
                        className={styles.modalHeaderLogo}
                        onError={onLogoError}
                    />
                ) : (
                    <LogoFrak
                        width={48}
                        height={48}
                        className={styles.modalHeaderLogoMark}
                    />
                )}
                <Stack space="xs" align="center">
                    <CurrentModalTitle metadataTitle={title} />
                    <CurrentModalMetadataInfo />
                </Stack>
            </Stack>
        </Stack>
    );
}

/**
 * Step-aware modal title — uses the metadata header title when set, otherwise
 * the current step's i18n title (`sdk.modal.<step>.title`). Wrapped in the
 * Radix Title for a11y; merchants can override the copy via customizations.i18n.
 */
function CurrentModalTitle({ metadataTitle }: { metadataTitle?: ReactNode }) {
    const { t, i18n } = useListenerTranslation();
    const currentStep = modalStore(selectCurrentStepObject);

    const stepTitle = useMemo(() => {
        if (!currentStep) return undefined;
        const context =
            currentStep.key === "final"
                ? currentStep.params.action.key
                : undefined;
        const key = `sdk.modal.${currentStep.key}.title`;
        return i18n.exists(key) ? t(key, { context }) : undefined;
    }, [currentStep, i18n, t]);

    return (
        <AlertDialogPrimitive.Title className={styles.modalHeaderTitle}>
            <Text
                as="span"
                variant="heading2"
                align="center"
                className={prefixModalCss("title")}
            >
                {metadataTitle || stepTitle || ""}
            </Text>
        </AlertDialogPrimitive.Title>
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

    // Render the Radix Description (always present for a11y) as the centered
    // subtitle. Markdown can emit block elements, so it lives in a styled div.
    return useMemo(() => {
        const description =
            descriptionKey && i18n.exists(descriptionKey)
                ? t(descriptionKey)
                : undefined;

        return (
            <AlertDialogPrimitive.Description asChild>
                <div
                    className={`${styles.modalListener__subtitle} ${prefixModalCss("description")}`}
                >
                    {description ? <Markdown md={description} /> : null}
                </div>
            </AlertDialogPrimitive.Description>
        );
    }, [descriptionKey, i18n, t]);
}

/**
 * Return the right inner component depending on the current modal step
 * @constructor
 */
function CurrentModalStepComponent() {
    const currentStep = modalStore(selectCurrentStep);
    const currentStepIndex = modalStore((s) => s.currentStep);
    const totalSteps = modalStore((s) => s.steps?.length ?? 0);

    // Emit modal_step_viewed on every step transition. Step completion is
    // inferred from the next step's _viewed event (or modal_dismissed with
    // last_step) so we don't need a dedicated _completed event.
    useEffect(() => {
        if (!currentStep) return;
        const stepKey =
            currentStep.key === "final" && currentStep.params.action?.key
                ? currentStep.params.action.key
                : currentStep.key;
        trackEvent("modal_step_viewed", {
            step: stepKey,
            index: currentStepIndex,
            total: totalSteps,
        });
    }, [currentStep, currentStepIndex, totalSteps]);

    /**
     * Return the right modal depending on the state
     */
    return useMemo(() => {
        // Extract some info about the current modal step
        if (!currentStep) return null;

        // Capture the key up front so the defensive default branch can still
        // report it — inside `default`, `currentStep` narrows to `never`.
        const stepKey = currentStep.key;

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
            case "final":
                return (
                    <FinalModalStep
                        params={currentStep.params}
                        onFinish={currentStep.onResponse}
                    />
                );
            default:
                return <>Can't handle {stepKey} yet</>;
        }
    }, [currentStep]);
}
