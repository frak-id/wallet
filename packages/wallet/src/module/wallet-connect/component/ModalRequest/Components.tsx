import { AlertDialog } from "@/module/common/component/AlertDialog";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Drawer, DrawerContent } from "@/module/common/component/Drawer";
import { Panel } from "@/module/common/component/Panel";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/component/EventsWalletConnect";
import styles from "@/module/wallet-connect/component/ModalRequest/index.module.css";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useMutation } from "@tanstack/react-query";
import { useMediaQuery } from "@uidotdev/usehooks";
import type { Verify } from "@walletconnect/types";
import type { SignClientTypes } from "@walletconnect/types/dist/types/sign-client/client";
import { getSdkError } from "@walletconnect/utils";
import {
    type Dispatch,
    type PropsWithChildren,
    type SetStateAction,
    useCallback,
    useMemo,
    useState,
} from "react";

/**
 * Global base for a wallet connect modal
 * @constructor
 */
export function WcModal({
    open,
    onOpenChange,
    children,
}: PropsWithChildren<{
    open: boolean;
    onOpenChange: Dispatch<SetStateAction<boolean>>;
}>) {
    return (
        <WcModalComponent open={open} onOpenChange={onOpenChange}>
            <section>{children}</section>
        </WcModalComponent>
    );
}

/**
 * Main component for the wallet connect modal (either drawer or alert bx depending on the client)
 * @param open
 * @param onOpenChange
 * @param children
 * @constructor
 */
function WcModalComponent({
    open,
    onOpenChange,
    children,
}: PropsWithChildren<{
    open: boolean;
    onOpenChange: Dispatch<SetStateAction<boolean>>;
}>) {
    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    if (isDesktop) {
        return (
            <AlertDialog
                text={children}
                open={open}
                onOpenChange={onOpenChange}
                showCloseButton={false}
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
 * Header for a wallet connect modal
 * @constructor
 */
export function WcModalHeader({
    metadata,
    verifyContext,
    subTitle,
    children,
}: PropsWithChildren<{
    metadata: SignClientTypes.Metadata;
    verifyContext: Verify.Context;
    subTitle: string;
}>) {
    // Extract icon, name and url from metadata
    const { icon, name, url } = useMemo(
        () => ({
            icon: metadata.icons?.[0],
            name: metadata.name,
            url: metadata.url,
        }),
        [metadata]
    );

    return (
        <header className={styles.modalPairing__header}>
            {icon && <img src={icon} alt={name} width={64} height={64} />}
            <h1 className={styles.modalPairing__title}>{name}</h1>
            <h2 className={styles.modalPairing__subTitle}>{subTitle}</h2>
            {url && (
                <p>
                    <a
                        href={url}
                        target={"_blank"}
                        rel={"noreferrer"}
                        className={styles.modalPairing__link}
                    >
                        {url}
                    </a>
                </p>
            )}
            <ContextWarningsInfo
                isScam={verifyContext.verified.isScam}
                validation={verifyContext.verified.validation}
            />
            {children}
        </header>
    );
}

function ContextWarningsInfo({
    isScam,
    validation,
}: { isScam?: boolean; validation?: "UNKNOWN" | "VALID" | "INVALID" }) {
    return (
        <>
            {isScam && <ScamWarning />}
            {validation === "UNKNOWN" && <UnknownWarning />}
            {validation === "INVALID" && <InvalidWarning />}
        </>
    );
}

function ScamWarning() {
    return (
        <p className={`error ${styles.modalPairing__error}`}>
            Known security risk.
            <br />
            This website is flagged as unsafe by multiple security reports.
            <br />
            Leave immediately to protect your assets.
        </p>
    );
}

function UnknownWarning() {
    return (
        <p className={styles.modalPairing__warning}>
            Unknown domain
            <br />
            This domain cannot be verified.
            <br />
            Please check the request carefully before approving.
        </p>
    );
}

function InvalidWarning() {
    return (
        <p className={styles.modalPairing__warning}>
            Domain mismatch
            <br />
            This website has a domain that does not match the sender of this
            request.
            <br />
            Approving may lead to loss of funds.
        </p>
    );
}

/**
 * Action for a wallet connect modal
 * @constructor
 */
export function WcModalAction({
    isLoading,
    isApproveDisabled,
    onApprove,
    onReject,
}: {
    isLoading: boolean;
    isApproveDisabled: boolean;
    onApprove: () => void;
    onReject: () => void;
}) {
    return (
        <div className={styles.modalPairing__buttons}>
            <ButtonRipple size={"small"} onClick={onReject}>
                Reject
            </ButtonRipple>
            <ButtonRipple
                size={"small"}
                disabled={isApproveDisabled}
                isLoading={isLoading}
                onClick={onApprove}
            >
                Approve
            </ButtonRipple>
        </div>
    );
}

/**
 * Action for a wallet connect modal
 * @constructor
 */
export function WcModalRequestContext({
    chain,
    protocol,
}: {
    chain: string;
    protocol: string;
}) {
    const formattedChain = useMemo(() => chain.replace("eip155:", ""), [chain]);
    return (
        <>
            <Panel size={"small"}>
                Chain: {formattedChain}
                <br />
                Protocol: {protocol}
            </Panel>
        </>
    );
}

/**
 * Generic request modal
 * @param args
 * @param isApproveDisabled
 * @param getApprovalData
 * @param onClose
 * @param children
 * @param subtitle
 * @param successMessage
 * @constructor
 */
export function RequestGenericModal({
    args,
    isApproveDisabled,
    getApprovalData,
    onClose,
    children,
    subtitle,
    successMessage,
}: PropsWithChildren<{
    args: Extract<WalletConnectRequestArgs, { type: "request" }>;
    isApproveDisabled: boolean;
    getApprovalData: () => Promise<unknown>;
    onClose: () => void;
    subtitle: string;
    successMessage: string;
}>) {
    const { walletConnectInstance } = useWalletConnect();

    const [isOpen, setIsOpen] = useState(true);

    const close = useCallback(() => {
        setIsOpen(false);
        onClose();
    }, [onClose]);

    /**
     * Mutation to approve the pairing
     */
    const {
        mutate: onApprove,
        isPending: isApproving,
        isSuccess: isApproveInSuccess,
        error: approveError,
    } = useMutation({
        mutationKey: ["session-request-approve", args.id],
        mutationFn: async () => {
            // Ensure we got everything needed
            if (!(walletConnectInstance && args.id)) {
                return;
            }

            // Try to sign the message
            const approvalData = await getApprovalData();

            // Send the signature
            await walletConnectInstance.respondSessionRequest({
                topic: args.topic,
                response: {
                    id: args.id,
                    jsonrpc: "2.0",
                    result: approvalData,
                },
            });

            // And close the modal after 3 seconds
            setTimeout(close, 3_000);
        },
    });

    /**
     * Mutation when the user rejects the pairing
     */
    const { mutate: onReject, isPending: isRejecting } = useMutation({
        mutationKey: ["session-request-regect", args.id],
        onMutate: async () => {
            // Ensure we got everything needed
            if (!(walletConnectInstance && args.id)) {
                return;
            }

            // Reject the sign proposal
            await walletConnectInstance.respondSessionRequest({
                topic: args.topic,
                response: {
                    id: args.id,
                    jsonrpc: "2.0",
                    error: {
                        // Code indicating a server error
                        code: -32000,
                        message: getSdkError("USER_REJECTED").message,
                    },
                },
            });

            // And close the modal
            close();
        },
    });

    /**
     * Check if we are loading
     */
    const isLoading = useMemo(
        () => isRejecting || isApproving,
        [isRejecting, isApproving]
    );

    return (
        <WcModal
            open={isOpen}
            onOpenChange={(value) => {
                if (value === false) {
                    onReject();
                }
            }}
        >
            <WcModalHeader
                metadata={args.session.peer.metadata}
                verifyContext={args.verifyContext}
                subTitle={subtitle}
            />

            <WcModalRequestContext
                chain={args.params.chainId}
                protocol={args.session.relay.protocol}
            />

            {children}

            {approveError && (
                <p className={`error ${styles.modalPairing__error}`}>
                    {approveError.message}
                </p>
            )}

            {isApproveInSuccess ? (
                <p className={styles.modalPairing__success}>{successMessage}</p>
            ) : (
                <WcModalAction
                    isLoading={isLoading}
                    isApproveDisabled={isApproveDisabled}
                    onApprove={onApprove}
                    onReject={onReject}
                />
            )}
        </WcModal>
    );
}
