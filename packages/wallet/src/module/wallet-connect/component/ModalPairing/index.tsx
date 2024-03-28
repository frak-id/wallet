import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { AlertDialogPairing } from "@/module/wallet-connect/component/AlertDialogPairing";
import { DrawerPairing } from "@/module/wallet-connect/component/DrawerPairing";
import {
    chainsNames,
    getNamespaces,
    getNotSupportedChains,
} from "@/module/wallet-connect/component/ModalPairing/utils";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useMediaQuery } from "@uidotdev/usehooks";
import { getSdkError } from "@walletconnect/utils";
import type { Web3WalletTypes } from "@walletconnect/web3wallet";
import { type Dispatch, type SetStateAction, useState } from "react";
import styles from "./index.module.css";

export function ModalPairing({
    id,
    params,
    verifyContext,
    open,
    onOpenChange,
}: Web3WalletTypes.SessionProposal & {
    open: boolean;
    onOpenChange: Dispatch<SetStateAction<boolean>>;
}) {
    const {
        proposer: { metadata },
        requiredNamespaces,
        optionalNamespaces,
    } = params;
    const {
        verified: { isScam, validation },
    } = verifyContext;
    const { name, url, icons } = metadata;
    const { wallet } = useWallet();
    const { walletConnectInstance, refreshSessions } = useWalletConnect();
    const [isLoading, setIsLoading] = useState(false);
    const notSupportedChains = getNotSupportedChains(
        requiredNamespaces,
        optionalNamespaces
    );

    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    const Component = isDesktop ? AlertDialogPairing : DrawerPairing;

    async function onUserAccepted() {
        if (!(id && walletConnectInstance)) return;
        try {
            setIsLoading(true);
            const namespaces = getNamespaces(params, wallet.address);
            // Approve session proposal, use id from session proposal event and respond with namespace(s) that satisfy dapps request and contain approved accounts
            const { topic, acknowledged } =
                await walletConnectInstance.approveSession({
                    id,
                    namespaces,
                });
            console.log("Wallet connect session proposal approved", {
                topic,
                acknowledged,
            });
            await refreshSessions();
        } catch (error) {
            console.error("Wallet connect session proposal error", { error });
            await walletConnectInstance.rejectSession({
                id,
                reason: getSdkError("USER_REJECTED"),
            });
        } finally {
            setIsLoading(false);
            onOpenChange(false);
        }
    }

    /**
     * Reject the session proposal
     */
    async function onUserRejected() {
        if (!(id && walletConnectInstance)) return;
        await walletConnectInstance?.rejectSession({
            id,
            reason: getSdkError("USER_REJECTED"),
        });
    }

    return (
        <>
            <Component
                open={open}
                onOpenChange={async (value) => {
                    // If the user closes the modal, reject the session
                    if (value === false) {
                        await onUserRejected();
                    }
                    onOpenChange(value);
                }}
            >
                <section>
                    <header className={styles.modalPairing__header}>
                        {icons?.[0] && (
                            <img
                                src={icons[0]}
                                alt={name}
                                width={64}
                                height={64}
                            />
                        )}
                        <h1 className={styles.modalPairing__title}>{name}</h1>
                        <h2 className={styles.modalPairing__subTitle}>
                            wants to connect
                        </h2>
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
                        {isScam && <ScamWarning />}
                        {validation === "UNKNOWN" && <UnknownWarning />}
                        {validation === "INVALID" && <InvalidWarning />}
                    </header>
                    {notSupportedChains.length > 0 && (
                        <p className={`error ${styles.modalPairing__error}`}>
                            Network not supported.
                            <br />
                            Networks available:{" "}
                            {chainsNames
                                .join(", ")
                                .replace(/,([^,]*)$/, " and$1")}
                        </p>
                    )}
                    <div className={styles.modalPairing__buttons}>
                        <ButtonRipple
                            size={"small"}
                            onClick={async () => {
                                onOpenChange(false);
                                await onUserRejected();
                            }}
                        >
                            Reject
                        </ButtonRipple>
                        <ButtonRipple
                            size={"small"}
                            disabled={notSupportedChains.length > 0}
                            isLoading={isLoading}
                            onClick={onUserAccepted}
                        >
                            Approve
                        </ButtonRipple>
                    </div>
                </section>
            </Component>
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
