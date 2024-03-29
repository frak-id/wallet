import { AlertDialog } from "@/module/common/component/AlertDialog";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Drawer, DrawerContent } from "@/module/common/component/Drawer";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/component/EventsWalletConnect";
import { PairingModal } from "@/module/wallet-connect/component/ModalRequest/Pairing";
import { useMediaQuery } from "@uidotdev/usehooks";
import type { Verify } from "@walletconnect/types";
import type { SignClientTypes } from "@walletconnect/types/dist/types/sign-client/client";
import {
    type Dispatch,
    type PropsWithChildren,
    type SetStateAction,
    useMemo,
} from "react";
import styles from "./index.module.css";

export function ModalWalletConnectRequest({
    args,
    onClose,
}: {
    args: WalletConnectRequestArgs;
    onClose: () => void;
}) {
    if (args.type === "pairing") {
        return <PairingModal args={args} onClose={onClose} />;
    }

    // TODO: Handle request type (for sign, send tx and stuff)

    return <> </>;
}

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
